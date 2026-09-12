import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testUrl = process.env.POSTGRES18_TEST_URL;
if (process.env.REQUIRE_POSTGRES18_TEST === "1" && !testUrl) {
  throw new Error("POSTGRES18_TEST_URL_REQUIRED");
}

const describePostgres18 = testUrl ? describe : describe.skip;
const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
const cleanDatabase = `dipbot_clean_${suffix}`;
const upgradeDatabase = `dipbot_upgrade_${suffix}`;

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
const sqlFile = (...segments: string[]) =>
  readFileSync(path.join(migrationsDir, ...segments), "utf8");

const MIGRATIONS = [
  sqlFile("0000_violet_gargoyle.sql"),
  sqlFile("0001_glorious_kulan_gath.sql"),
  sqlFile("0002_left_pride.sql"),
  sqlFile("0003_unusual_blue_shield.sql"),
  sqlFile("0004_stale_black_knight.sql"),
  sqlFile("0005_cooing_vapor.sql"),
  sqlFile("0006_whole_living_tribunal.sql"),
  sqlFile("0007_burly_amazoness.sql"),
  sqlFile("0008_gigantic_taskmaster.sql"),
  sqlFile("0009_strange_stryfe.sql"),
  sqlFile("0010_wandering_hulk.sql"),
  sqlFile("0011_silky_omega_sentinel.sql"),
  sqlFile("0012_black_valkyrie.sql"),
  sqlFile("0013_immutable_audit_history.sql"),
  sqlFile("0014_bouncy_zuras.sql"),
];
const BACKFILL = sqlFile("manual", "001_backfill_ownership.sql");
const VERIFY = sqlFile("manual", "002_verify_ownership.sql");

const databaseUrl = (database: string) => {
  const url = new URL(testUrl as string);
  url.pathname = `/${database}`;
  return url.toString();
};

const withClient = async <T>(
  database: string,
  work: (client: pg.Client) => Promise<T>,
): Promise<T> => {
  const client = new pg.Client({ connectionString: databaseUrl(database) });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
};

const inTransaction = async (client: pg.Client, sql: string) => {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const seedOwnedWorld = async (
  client: pg.Client,
  includeLegacyOrder: boolean,
) => {
  await client.query(`
    INSERT INTO users (id, telegram_user_id, telegram_chat_id, username)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000001', '111', '111', 'alice'),
      ('bbbbbbbb-0000-4000-8000-000000000002', '222', '222', 'bob');

    INSERT INTO strategies (id, user_id, name, symbol, mode, enabled, config)
    VALUES
      ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       'Alice BTC', 'BTCUSDT', 'DRY_RUN', true, '{}'::jsonb),
      ('22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
       'Bob BTC', 'BTCUSDT', 'DRY_RUN', true, '{}'::jsonb);
  `);

  if (includeLegacyOrder) {
    await client.query(`
      INSERT INTO orders (id, strategy_id, symbol, mode, side, quote_amount, price, status)
      VALUES ('33333333-0000-4000-8000-000000000001',
              '11111111-0000-4000-8000-000000000001',
              'BTCUSDT', 'DRY_RUN', 'BUY', '100', '50000', 'COMPLETED');
    `);
  }
};

const catalog = async (database: string) =>
  withClient(database, async (client) => {
    const columns = await client.query<{
      table_name: string;
      column_name: string;
      is_nullable: string;
      data_type: string;
    }>(`
      SELECT table_name, column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users','api_sessions','telegram_login_presentations','telegram_login_abuse_limits','strategies','orders','audit_events','notification_outbox')
      ORDER BY table_name, ordinal_position
    `);
    const constraints = await client.query<{
      table_name: string;
      name: string;
      definition: string;
    }>(`
      SELECT c.conrelid::regclass::text AS table_name,
             c.conname AS name,
             pg_get_constraintdef(c.oid, true) AS definition
      FROM pg_constraint c
      WHERE c.connamespace = 'public'::regnamespace
        AND c.conrelid::regclass::text IN
          ('users','api_sessions','telegram_login_presentations','telegram_login_abuse_limits','strategies','orders','audit_events','notification_outbox')
      ORDER BY table_name, name, definition
    `);
    const indexes = await client.query<{
      tablename: string;
      indexdef: string;
    }>(`
      SELECT tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('users','api_sessions','telegram_login_presentations','telegram_login_abuse_limits','strategies','orders','audit_events','notification_outbox')
      ORDER BY tablename, indexdef
    `);
    const triggers = await client.query<{
      table_name: string;
      definition: string;
    }>(`
      SELECT tgrelid::regclass::text AS table_name,
             pg_get_triggerdef(oid, true) AS definition
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgrelid::regclass::text IN ('audit_events')
      ORDER BY table_name, definition
    `);
    return {
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      triggers: triggers.rows,
    };
  });

const insertV1AuditEvent = async (client: pg.Client, id: string) => {
  await client.query(
    `INSERT INTO audit_events (
       id, schema_version, user_id, scope, actor_kind, actor_channel,
       actor_user_id, entity_type, entity_id, action, reason_code,
       correlation_id, payload_class, payload
     ) VALUES (
       $1, 1, 'aaaaaaaa-0000-4000-8000-000000000001', 'USER', 'USER', 'WEB',
       'aaaaaaaa-0000-4000-8000-000000000001', 'strategy',
       '11111111-0000-4000-8000-000000000001', 'STRATEGY_CREATED',
       'USER_REQUEST', 'pg18_audit_v1', 'TENANT_CONFIGURATION', '{}'::jsonb
     )`,
    [id],
  );
};

const expectCrossOwnerInsertRejected = async (database: string) =>
  withClient(database, async (client) => {
    await expect(
      client.query(`
        INSERT INTO orders (user_id, strategy_id, symbol, mode, side, quote_amount, price, status)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000001',
                '22222222-0000-4000-8000-000000000002',
                'BTCUSDT', 'DRY_RUN', 'BUY', '10', '50000', 'COMPLETED')
      `),
    ).rejects.toMatchObject({ code: "23503" });
  });

describePostgres18("PostgreSQL 18 ownership contract", () => {
  beforeAll(async () => {
    await withClient("postgres", async (admin) => {
      const version = await admin.query<{ server_version_num: string }>(
        "SHOW server_version_num",
      );
      expect(
        Number(version.rows[0]?.server_version_num),
      ).toBeGreaterThanOrEqual(180_000);
      expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(190_000);
      await admin.query(`CREATE DATABASE "${cleanDatabase}"`);
      await admin.query(`CREATE DATABASE "${upgradeDatabase}"`);
    });

    await withClient(cleanDatabase, async (client) => {
      for (const migration of MIGRATIONS) {
        await inTransaction(client, migration);
      }
      await seedOwnedWorld(client, false);
    });

    await withClient(upgradeDatabase, async (client) => {
      for (const migration of MIGRATIONS.slice(0, 3)) {
        await inTransaction(client, migration);
      }
      await seedOwnedWorld(client, true);
      await client.query(BACKFILL);
      await client.query(VERIFY);
      const unresolved = await client.query<{ count: string }>(`
        SELECT count(*) FROM orders o
        JOIN strategies s ON s.id = o.strategy_id
        WHERE o.user_id IS NULL OR o.user_id IS DISTINCT FROM s.user_id
      `);
      expect(Number(unresolved.rows[0]?.count)).toBe(0);
      for (const migration of MIGRATIONS.slice(3, 9)) {
        await inTransaction(client, migration);
      }
      await client.query(`
        INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, payload)
        VALUES (
          '44444444-0000-4000-8000-000000000004',
          'aaaaaaaa-0000-4000-8000-000000000001',
          'strategy',
          '11111111-0000-4000-8000-000000000001',
          'LEGACY_STRATEGY_CREATED', '{}'::jsonb
        )
      `);
      for (const migration of MIGRATIONS.slice(9)) {
        await inTransaction(client, migration);
      }
    });
  }, 60_000);

  afterAll(async () => {
    if (!testUrl) return;
    await withClient("postgres", async (admin) => {
      await admin.query(
        `DROP DATABASE IF EXISTS "${cleanDatabase}" WITH (FORCE)`,
      );
      await admin.query(
        `DROP DATABASE IF EXISTS "${upgradeDatabase}" WITH (FORCE)`,
      );
    });
  });

  it("ends clean install and real upgrade at an identical catalog", async () => {
    expect(await catalog(upgradeDatabase)).toEqual(
      await catalog(cleanDatabase),
    );
  });

  it("rejects cross-owner order relationships on both paths", async () => {
    await expectCrossOwnerInsertRejected(cleanDatabase);
    await expectCrossOwnerInsertRejected(upgradeDatabase);
  });

  it("keeps the upgraded legacy order attributed to its strategy owner", async () => {
    await withClient(upgradeDatabase, async (client) => {
      const result = await client.query<{ user_id: string }>(
        "SELECT user_id FROM orders WHERE id = '33333333-0000-4000-8000-000000000001'",
      );
      expect(result.rows[0]?.user_id).toBe(
        "aaaaaaaa-0000-4000-8000-000000000001",
      );
    });
  });

  it("preserves V0 audit rows across the 0009/0010 upgrade", async () => {
    await withClient(upgradeDatabase, async (client) => {
      const result = await client.query<{
        schema_version: number;
        action: string;
        scope: string | null;
      }>(`
        SELECT schema_version, action, scope
        FROM audit_events
        WHERE id = '44444444-0000-4000-8000-000000000004'
      `);
      expect(result.rows).toEqual([
        {
          schema_version: 0,
          action: "LEGACY_STRATEGY_CREATED",
          scope: null,
        },
      ]);
    });
  });

  it("enforces the 0010 V1 action envelope on both install paths", async () => {
    await withClient(cleanDatabase, async (client) => {
      await insertV1AuditEvent(client, "55555555-0000-4000-8000-000000000005");
      await expect(
        client.query(`
          INSERT INTO audit_events (
            schema_version, user_id, scope, actor_kind, actor_channel,
            actor_user_id, entity_type, entity_id, action, reason_code,
            correlation_id, payload_class, payload
          ) VALUES (
            1, 'aaaaaaaa-0000-4000-8000-000000000001', 'USER', 'USER', 'WEB',
            'aaaaaaaa-0000-4000-8000-000000000001', 'strategy',
            '11111111-0000-4000-8000-000000000001', 'NOT_A_V1_ACTION',
            'USER_REQUEST', 'pg18_invalid_action', 'TENANT_CONFIGURATION', '{}'::jsonb
          )
        `),
      ).rejects.toMatchObject({ code: "23514" });
    });

    await withClient(upgradeDatabase, async (client) => {
      await insertV1AuditEvent(client, "66666666-0000-4000-8000-000000000006");
    });
  });

  it("makes every audit row immutable while retaining V0 evidence", async () => {
    await withClient(cleanDatabase, async (client) => {
      await expect(
        client.query(`
          UPDATE audit_events
          SET reason_code = 'CHANGED'
          WHERE id = '55555555-0000-4000-8000-000000000005'
        `),
      ).rejects.toMatchObject({
        message: expect.stringContaining("AUDIT_EVENT_IMMUTABLE"),
      });
      await expect(
        client.query(`
          DELETE FROM audit_events
          WHERE id = '55555555-0000-4000-8000-000000000005'
        `),
      ).rejects.toMatchObject({
        message: expect.stringContaining("AUDIT_EVENT_IMMUTABLE"),
      });
    });

    await withClient(upgradeDatabase, async (client) => {
      await expect(
        client.query(`
          UPDATE audit_events
          SET action = 'LEGACY_STRATEGY_UPDATED'
          WHERE id = '44444444-0000-4000-8000-000000000004'
        `),
      ).rejects.toMatchObject({
        message: expect.stringContaining("AUDIT_EVENT_IMMUTABLE"),
      });
      await expect(
        client.query(`
          DELETE FROM audit_events
          WHERE id = '44444444-0000-4000-8000-000000000004'
        `),
      ).rejects.toMatchObject({
        message: expect.stringContaining("AUDIT_EVENT_IMMUTABLE"),
      });

      const result = await client.query<{
        action: string;
        schema_version: number;
      }>(`
        SELECT action, schema_version FROM audit_events
        WHERE id = '44444444-0000-4000-8000-000000000004'
      `);
      expect(result.rows).toEqual([
        { action: "LEGACY_STRATEGY_CREATED", schema_version: 0 },
      ]);
    });
  });

  it("keeps the V1 envelope and all-version immutability catalog-identical", async () => {
    const clean = await catalog(cleanDatabase);
    const upgrade = await catalog(upgradeDatabase);
    expect(upgrade).toEqual(clean);
    const envelope = clean.constraints.find(
      (constraint) =>
        constraint.table_name === "audit_events" &&
        constraint.name === "audit_events_v1_envelope_check",
    );
    expect(envelope?.definition).toContain("AUTH_LOGIN_SUCCEEDED");
    expect(envelope?.definition).toContain("DRY_RUN_ORDER_CANCELLED");
    expect(clean.triggers).toHaveLength(1);
    expect(clean.triggers[0]?.definition).toContain("audit_events_immutable");
  });
});
