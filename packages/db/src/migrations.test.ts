import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDatabase } from "./testing.js";

// The committed migrations, executed against a real Postgres.
//
// Until now 0002 had only ever been read. A migration that cannot actually
// run is a deploy-time outage, so it is worth failing here instead.

interface ColumnRow {
  column_name: string;
  is_nullable: string;
  data_type: string;
}

let harness: TestDatabase;

const query = async <T>(sql: string): Promise<T[]> => {
  const result = (await harness.exec(sql)) as Array<{ rows: T[] }>;
  return result.flatMap((r) => r.rows ?? []);
};

beforeAll(async () => {
  harness = await createTestDb();
}, 60_000);

afterAll(async () => {
  await harness?.close();
});

describe("committed migrations", () => {
  it("apply cleanly from an empty database", async () => {
    const tables = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const names = tables.map((t) => t.table_name);
    expect(names).toContain("users");
    expect(names).toContain("strategies");
    expect(names).toContain("orders");
    expect(names).toContain("audit_events");
    expect(names).toContain("api_sessions");
    expect(names).toContain("telegram_login_presentations");
    expect(names).toContain("telegram_login_abuse_limits");
    expect(names).toContain("notification_outbox");
  });

  it("stores only constrained pseudonymous login-abuse state", async () => {
    const columns = await query<ColumnRow>(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns
       WHERE table_name = 'telegram_login_abuse_limits'
       ORDER BY column_name`,
    );
    expect(columns).toEqual([
      { column_name: "abuse_key", is_nullable: "NO", data_type: "text" },
      {
        column_name: "attempt_count",
        is_nullable: "NO",
        data_type: "integer",
      },
      {
        column_name: "blocked_until",
        is_nullable: "YES",
        data_type: "timestamp without time zone",
      },
      {
        column_name: "updated_at",
        is_nullable: "NO",
        data_type: "timestamp without time zone",
      },
      {
        column_name: "window_started_at",
        is_nullable: "NO",
        data_type: "timestamp without time zone",
      },
    ]);

    await expect(
      harness.exec(
        `INSERT INTO telegram_login_abuse_limits
           (abuse_key, window_started_at, attempt_count)
         VALUES ('raw-client-address', now(), 1)`,
      ),
    ).rejects.toThrow();
  });

  it("creates api_sessions with the columns the session repository expects", async () => {
    const columns = await query<ColumnRow>(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns
       WHERE table_name = 'api_sessions' ORDER BY column_name`,
    );
    const byName = Object.fromEntries(columns.map((c) => [c.column_name, c]));

    expect(Object.keys(byName).sort()).toEqual([
      "correlation_id",
      "created_at",
      "expires_at",
      "id",
      "kind",
      "last_used_at",
      "revoked_at",
      "token_hash",
      "user_id",
    ]);
    // A nullable owner or expiry would let an unattributable session exist.
    expect(byName.user_id?.is_nullable).toBe("NO");
    expect(byName.token_hash?.is_nullable).toBe("NO");
    expect(byName.expires_at?.is_nullable).toBe("NO");
    expect(byName.correlation_id?.is_nullable).toBe("YES");
    // Revocation is an absence until it happens.
    expect(byName.revoked_at?.is_nullable).toBe("YES");

    await harness.exec(
      `INSERT INTO users (id, telegram_user_id)
       VALUES ('99999999-2222-4333-8444-555555555555', 'session-correlation-test')`,
    );
    await expect(
      harness.exec(
        `INSERT INTO api_sessions
           (user_id, token_hash, correlation_id, expires_at)
         VALUES (
           '99999999-2222-4333-8444-555555555555',
           'invalid-correlation-fixture', 'bad', now() + interval '1 day'
         )`,
      ),
    ).rejects.toThrow();
  });

  it("keeps web identity separate from verified Telegram delivery", async () => {
    const columns = await query<ColumnRow>(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns
       WHERE table_name = 'users'
         AND column_name IN ('telegram_chat_id','notification_enabled_at')
       ORDER BY column_name`,
    );
    expect(columns).toEqual([
      {
        column_name: "notification_enabled_at",
        is_nullable: "YES",
        data_type: "timestamp without time zone",
      },
      {
        column_name: "telegram_chat_id",
        is_nullable: "YES",
        data_type: "text",
      },
    ]);
  });

  it("ends a clean install at the contracted ownership catalog", async () => {
    const columns = await query<ColumnRow & { table_name: string }>(
      `SELECT table_name, column_name, is_nullable FROM information_schema.columns
       WHERE column_name = 'user_id' AND table_name IN ('orders','audit_events','strategies')
       ORDER BY table_name`,
    );
    expect(columns).toEqual([
      {
        table_name: "audit_events",
        column_name: "user_id",
        is_nullable: "YES",
      },
      { table_name: "orders", column_name: "user_id", is_nullable: "NO" },
      { table_name: "strategies", column_name: "user_id", is_nullable: "NO" },
    ]);
  });

  it("installs the same-owner composite foreign key", async () => {
    const constraints = await query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'orders'::regclass AND contype = 'f'`,
    );
    expect(constraints.map((constraint) => constraint.conname)).toContain(
      "orders_user_id_strategy_id_strategies_user_id_id_fk",
    );
  });

  it("couples outbox order evidence to the same tenant", async () => {
    const constraints = await query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'notification_outbox'::regclass AND contype = 'f'`,
    );
    expect(constraints.map((constraint) => constraint.conname)).toContain(
      "notification_outbox_user_id_order_id_orders_user_id_id_fk",
    );
  });

  it("stores typed notification inputs instead of rendered financial messages", async () => {
    const columns = await query<ColumnRow>(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns
       WHERE table_name = 'notification_outbox'
       ORDER BY column_name`,
    );
    const byName = Object.fromEntries(
      columns.map((column) => [column.column_name, column]),
    );

    expect(byName.message).toBeUndefined();
    expect(byName.kind).toBeUndefined();
    expect(byName.classification?.is_nullable).toBe("NO");
    expect(byName.template_version?.data_type).toBe("smallint");
    expect(byName.template_key?.is_nullable).toBe("NO");
    expect(byName.render_inputs?.data_type).toBe("jsonb");
    expect(byName.correlation_id?.is_nullable).toBe("NO");

    const constraints = await query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'notification_outbox'::regclass AND contype = 'c'`,
    );
    const names = constraints.map((constraint) => constraint.conname);
    expect(names).toContain("notification_outbox_classification_check");
    expect(names).toContain("notification_outbox_template_check");
    expect(names).toContain("notification_outbox_render_inputs_check");
    expect(names).toContain("notification_outbox_correlation_id_check");
  });

  it("enforces a unique index on the session token hash", async () => {
    const indexes = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'api_sessions'`,
    );
    expect(indexes.map((i) => i.indexname)).toContain(
      "api_sessions_token_hash_idx",
    );
  });

  it("creates the ownership lookup indexes the scoped queries rely on", async () => {
    const indexes = await query<{ indexname: string; tablename: string }>(
      `SELECT tablename, indexname FROM pg_indexes
       WHERE schemaname = 'public'`,
    );
    const names = indexes.map((i) => i.indexname);
    expect(names).toContain("strategies_user_id_idx");
    expect(names).toContain("orders_user_id_created_at_idx");
    expect(names).toContain("audit_events_user_id_created_at_idx");
    expect(names).toContain("orders_one_pending_per_strategy_idx");
  });

  it("installs the V1 audit envelope columns and versioned default", async () => {
    const columns = await query<ColumnRow>(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns
       WHERE table_name = 'audit_events'
         AND column_name IN (
           'schema_version', 'scope', 'actor_kind', 'actor_channel',
           'actor_user_id', 'reason_code', 'correlation_id', 'payload_class'
         )
       ORDER BY column_name`,
    );
    expect(columns).toEqual([
      { column_name: "actor_channel", is_nullable: "YES", data_type: "text" },
      { column_name: "actor_kind", is_nullable: "YES", data_type: "text" },
      { column_name: "actor_user_id", is_nullable: "YES", data_type: "uuid" },
      { column_name: "correlation_id", is_nullable: "YES", data_type: "text" },
      { column_name: "payload_class", is_nullable: "YES", data_type: "text" },
      { column_name: "reason_code", is_nullable: "YES", data_type: "text" },
      {
        column_name: "schema_version",
        is_nullable: "NO",
        data_type: "smallint",
      },
      { column_name: "scope", is_nullable: "YES", data_type: "text" },
    ]);

    const defaults = await query<{ column_default: string | null }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_name = 'audit_events' AND column_name = 'schema_version'`,
    );
    expect(defaults[0]?.column_default).toContain("1");
  });

  it("prevents update and deletion of both V0 and V1 audit evidence", async () => {
    await harness.exec(`
      INSERT INTO users (id, telegram_user_id)
      VALUES ('99999999-3333-4333-8333-555555555555', 'audit-immutability-test');

      INSERT INTO audit_events (
        id, schema_version, user_id, entity_type, entity_id, action, payload
      ) VALUES (
        '99999999-3333-4333-8333-555555555550', 0,
        '99999999-3333-4333-8333-555555555555', 'strategy',
        '99999999-3333-4333-8333-555555555551', 'LEGACY_STRATEGY_CREATED',
        '{}'::jsonb
      );

      INSERT INTO audit_events (
        id, schema_version, user_id, scope, actor_kind, actor_channel,
        actor_user_id, entity_type, entity_id, action, reason_code,
        correlation_id, payload_class, payload
      ) VALUES (
        '99999999-3333-4333-8333-555555555552', 1,
        '99999999-3333-4333-8333-555555555555', 'USER', 'USER', 'API',
        '99999999-3333-4333-8333-555555555555', 'strategy',
        '99999999-3333-4333-8333-555555555551', 'STRATEGY_CREATED',
        'USER_REQUEST', 'migration_contract_audit', 'TENANT_CONFIGURATION',
        '{}'::jsonb
      );
    `);

    for (const id of [
      "99999999-3333-4333-8333-555555555550",
      "99999999-3333-4333-8333-555555555552",
    ]) {
      await expect(
        harness.exec(
          `UPDATE audit_events SET entity_type = 'changed' WHERE id = '${id}'`,
        ),
      ).rejects.toThrow("AUDIT_EVENT_IMMUTABLE");
      await expect(
        harness.exec(`DELETE FROM audit_events WHERE id = '${id}'`),
      ).rejects.toThrow("AUDIT_EVENT_IMMUTABLE");
    }

    const retained = await query<{ id: string; schema_version: number }>(
      `SELECT id, schema_version FROM audit_events
       WHERE id IN (
         '99999999-3333-4333-8333-555555555550',
         '99999999-3333-4333-8333-555555555552'
       ) ORDER BY schema_version`,
    );
    expect(retained).toEqual([
      {
        id: "99999999-3333-4333-8333-555555555550",
        schema_version: 0,
      },
      {
        id: "99999999-3333-4333-8333-555555555552",
        schema_version: 1,
      },
    ]);
  });

  it("allows only one active pending order per owned strategy", async () => {
    await harness.exec(`
      INSERT INTO users (id, telegram_user_id, telegram_chat_id)
      VALUES ('aaaaaaaa-1111-4111-8111-111111111111', 'pending-test', 'pending-test');
      INSERT INTO strategies (id, user_id, name, symbol, mode, enabled, config)
      VALUES ('bbbbbbbb-1111-4111-8111-111111111111',
              'aaaaaaaa-1111-4111-8111-111111111111',
              'Pending guard', 'BTCUSDT', 'DRY_RUN', true, '{}'::jsonb);
      INSERT INTO orders (user_id, strategy_id, symbol, mode, side, quote_amount, status)
      VALUES ('aaaaaaaa-1111-4111-8111-111111111111',
              'bbbbbbbb-1111-4111-8111-111111111111',
              'BTCUSDT', 'DRY_RUN', 'BUY', '10', 'PENDING');
    `);

    await expect(
      harness.exec(`
        INSERT INTO orders (user_id, strategy_id, symbol, mode, side, quote_amount, status)
        VALUES ('aaaaaaaa-1111-4111-8111-111111111111',
                'bbbbbbbb-1111-4111-8111-111111111111',
                'BTCUSDT', 'DRY_RUN', 'BUY', '20', 'PENDING');
      `),
    ).rejects.toThrow();
  });

  it("refuses a session row pointing at a user that does not exist", async () => {
    // Proves the FK from 0002 is real, not just declared in the schema file.
    await expect(
      harness.exec(
        `INSERT INTO api_sessions (user_id, token_hash, expires_at)
         VALUES ('11111111-2222-3333-4444-555555555555', 'deadbeef', now() + interval '1 day')`,
      ),
    ).rejects.toThrow();
  });
});
