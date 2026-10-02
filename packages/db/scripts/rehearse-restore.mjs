import assert from "node:assert/strict";
import pg from "pg";
import { createPostgresConnection, runMigrations } from "../dist/index.mjs";

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

const fingerprint = async (table, columns) => {
  const projection = columns.map(pg.escapeIdentifier).join(", ");
  const { rows } = await connection.pool.query(`
    SELECT count(*)::text AS count,
      md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY r.id), '')) AS digest
    FROM (SELECT ${projection} FROM public.${pg.escapeIdentifier(table)}) r
  `);
  return rows[0];
};

try {
  const { rows: version } = await connection.pool.query(
    "SHOW server_version_num",
  );
  assert.ok(Number(version[0].server_version_num) >= 180000);
  assert.ok(Number(version[0].server_version_num) < 190000);
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
  // A second migration invocation must recognize the same catalog and journal.
  await runMigrations(connection.db);

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
