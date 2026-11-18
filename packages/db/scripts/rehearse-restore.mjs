import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { inArray } from "drizzle-orm";
import pg from "pg";
import {
  createPostgresConnection,
  runMigrations,
  schema,
  verifyRuntimeDatabase,
  withPersonalTenant,
} from "../dist/index.mjs";

// This entrypoint accepts only an isolated, local restored copy, never production.
const target = (() => {
  try {
    const url = new URL(process.env.POSTGRES_CONNECTION_STRING ?? "invalid:");
    if (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      !url.search &&
      !url.hash &&
      /^\/dipbot_rehearsal_[a-z0-9_]+$/.test(url.pathname)
    )
      return url;
  } catch {
    // Invalid URLs can contain credentials; never expose the native error.
  }
  throw new Error("ISOLATED_REHEARSAL_DATABASE_REQUIRED");
})();

const connection = createPostgresConnection(target.toString());
const preservedTables = ["audit_events", "orders", "strategies"];
const preparedMarker = "dipbot-isolated-restore-v1";

// Database archives contain object ACLs and policies, but do not create
// cluster roles or memberships. A restore into a differently named database
// also needs the reviewed database-level privileges on that database.
const prepareFreshCluster = async () => {
  const { rows } = await connection.pool.query(
    "SELECT 1 FROM pg_roles WHERE rolname <> 'postgres' AND rolname !~ '^pg_' LIMIT 1",
  );
  if (rows.length) throw new Error("FRESH_REHEARSAL_CLUSTER_REQUIRED");
  const database = pg.escapeIdentifier(target.pathname.slice(1));
  await connection.pool.query(`
    BEGIN;
    CREATE ROLE dipbot_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE dipbot_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
    GRANT dipbot_app TO dipbot_runtime WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
    REVOKE CREATE, TEMPORARY ON DATABASE ${database} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${database} TO dipbot_runtime;
    COMMENT ON DATABASE ${database} IS ${pg.escapeLiteral(preparedMarker)};
    COMMIT;
  `);
};

const checkRuntimeAccess = async () => {
  // The prepared cluster starts with a disabled runtime login. Generate a
  // credential exclusively for this restore, and use the real migrator CLI.
  const role = await connection.pool.query(
    "SELECT rolcanlogin FROM pg_roles WHERE rolname='dipbot_runtime'",
  );
  if (role.rows[0]?.rolcanlogin !== false)
    throw new Error("DISABLED_REHEARSAL_RUNTIME_ROLE_REQUIRED");
  const password = randomBytes(32).toString("hex");
  const runtimeUrl = new URL(target);
  runtimeUrl.username = "dipbot_runtime";
  runtimeUrl.password = password;
  const runtime = createPostgresConnection(runtimeUrl.toString());
  try {
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("./migrate.mjs", import.meta.url))],
      {
        env: {
          ...process.env,
          APP_RUNTIME: "non-local",
          POSTGRES_RUNTIME_PASSWORD: password,
        },
        stdio: "pipe",
      },
    );
    await verifyRuntimeDatabase(runtime.db);
    // Roll back both synthetic identities, their personal tenants and the
    // strategy. Test tenant resolution and RLS with the actual runtime login.
    const owners = [randomUUID(), randomUUID()];
    const rollback = new Error("ROLLBACK_REHEARSAL_FIXTURE");
    await runtime.db
      .transaction(async (tx) => {
        await tx
          .insert(schema.users)
          .values(
            owners.map((id) => ({ id, telegramUserId: `rehearsal-${id}` })),
          );
        await withPersonalTenant(tx, owners[0], async (tenant) => {
          const visibleOwners = await tenant
            .select({ id: schema.tenants.personalOwnerUserId })
            .from(schema.tenants)
            .where(inArray(schema.tenants.personalOwnerUserId, owners));
          assert.deepEqual(visibleOwners, [{ id: owners[0] }]);
          await tenant.insert(schema.strategies).values({
            userId: owners[0],
            name: "Restore verification",
            symbol: "BTCUSDT",
            config: {},
          });
          const visibleStrategies = await tenant
            .select({ owner: schema.strategies.userId })
            .from(schema.strategies)
            .limit(2);
          assert.deepEqual(visibleStrategies, [{ owner: owners[0] }]);
        });
        throw rollback;
      })
      .catch((error) => {
        if (error !== rollback) throw error;
      });
    process.stdout.write("RESTORED_RUNTIME_AND_TENANT_ACCESS_OK\n");
  } finally {
    await runtime.pool.end();
    await connection.pool.query(
      "ALTER ROLE dipbot_runtime NOLOGIN PASSWORD NULL",
    );
  }
};

const fingerprint = async (table, columns) => {
  const projection = columns.map(pg.escapeIdentifier).join(", ");
  const { rows } = await connection.pool.query(`
    SELECT count(*)::text AS count,
      md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY r.id), '')) AS digest
    FROM (SELECT ${projection} FROM public.${pg.escapeIdentifier(table)}) r
  `);
  return rows[0];
};

const verifyRestore = async () => {
  const { rows: prepared } = await connection.pool.query(
    "SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()",
  );
  if (prepared[0]?.marker !== preparedMarker)
    throw new Error("PREPARED_REHEARSAL_CLUSTER_REQUIRED");
  const { rows: journalBefore } = await connection.pool.query(
    "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  assert.ok(journalBefore.length > 0, "RESTORED_JOURNAL_REQUIRED");

  const snapshots = [];
  for (const table of preservedTables) {
    const { rows } = await connection.pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table],
    );
    // The cost-first bridge derives this owner from its already-owned tenant.
    // Everything else present before migration, including audit payloads and
    // exact numeric values, must survive unchanged.
    const columns = rows
      .map((row) => row.column_name)
      .filter((column) => table !== "strategies" || column !== "user_id");
    assert.ok(columns.includes("id"), "RESTORED_TABLE_REQUIRED");
    snapshots.push({
      table,
      columns,
      before: await fingerprint(table, columns),
    });
  }

  await runMigrations(connection.db);
  // The deployment CLI must recognize the same catalog on a second run.
  await checkRuntimeAccess();

  for (const { table, columns, before } of snapshots) {
    assert.deepEqual(await fingerprint(table, columns), before);
    process.stdout.write(`PRESERVED ${table} rows=${before.count}\n`);
  }
  const { rows: journalAfter } = await connection.pool.query(
    "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  assert.deepEqual(journalAfter, journalBefore);
  const { rows: ownership } = await connection.pool.query(`
    SELECT
      (SELECT count(*) FROM strategies s LEFT JOIN tenants t ON t.id=s.tenant_id
       WHERE t.id IS NULL OR s.user_id IS DISTINCT FROM t.personal_owner_user_id) AS strategies,
      (SELECT count(*) FROM orders o LEFT JOIN strategies s ON s.id=o.strategy_id
       WHERE s.id IS NULL OR o.user_id IS DISTINCT FROM s.user_id
          OR o.tenant_id IS DISTINCT FROM s.tenant_id) AS orders
  `);
  assert.equal(ownership[0].strategies, "0");
  assert.equal(ownership[0].orders, "0");
  process.stdout.write(
    "RESTORE_MIGRATION_REHEARSAL_OK original journal and financial/audit fields preserved\n",
  );
};

try {
  const { rows: version } = await connection.pool.query(
    "SHOW server_version_num",
  );
  assert.ok(Number(version[0].server_version_num) >= 180000);
  assert.ok(Number(version[0].server_version_num) < 190000);
  // Runtime credentials are cluster-wide. Refuse shared clusters regardless
  // of the selected rehearsal database name.
  const { rows: otherDatabases } = await connection.pool.query(
    "SELECT 1 FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres', current_database()) LIMIT 1",
  );
  if (otherDatabases.length)
    throw new Error("DEDICATED_REHEARSAL_CLUSTER_REQUIRED");
  if (process.argv.length === 2) await verifyRestore();
  else if (
    process.argv.length === 3 &&
    process.argv[2] === "--prepare-fresh-cluster"
  )
    await prepareFreshCluster();
  else throw new Error("REHEARSAL_ARGUMENT_INVALID");
} catch (error) {
  // Never emit SQL, row values or assertion diffs from a real backup.
  let code = "RESTORE_MIGRATION_REHEARSAL_FAILED";
  let cause = error;
  for (let depth = 0; depth < 4 && cause instanceof Error; depth += 1) {
    const match = /^([A-Z][A-Z0-9_]+)(?::|$)/.exec(cause.message);
    if (match) {
      code = match[1];
      break;
    }
    cause = cause.cause;
  }
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
} finally {
  await connection.pool.end();
}
