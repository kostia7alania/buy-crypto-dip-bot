import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyTestDb, type TestDatabase } from "./testing.js";

// The manual ownership migration, executed for real.
//
// These scripts rewrite who owns live trading history, so "it looked right
// when I read it" is not a standard worth shipping on. Each one runs here
// against a real Postgres with deliberately awkward data.

const manualDir = () =>
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../migrations/manual",
  );

const migrationsDir = () => path.resolve(manualDir(), "..");

const script = (name: string) =>
  readFileSync(path.join(manualDir(), name), "utf8");

const migration = (name: string) =>
  readFileSync(path.join(migrationsDir(), name), "utf8");

const BACKFILL = script("001_backfill_ownership.sql");
const VERIFY = script("002_verify_ownership.sql");
const CONTRACT = migration("0003_unusual_blue_shield.sql");
const EXPAND_MIGRATIONS = [
  migration("0000_violet_gargoyle.sql"),
  migration("0001_glorious_kulan_gath.sql"),
  migration("0002_left_pride.sql"),
].join("\n");

let harness: TestDatabase;

afterEach(async () => {
  await harness?.close();
});

const rows = async <T>(sql: string): Promise<T[]> => {
  const result = (await harness.exec(sql)) as Array<{ rows: T[] }>;
  return result.flatMap((r) => r.rows ?? []);
};

interface VerifyRow {
  category: string;
  must_be_zero: string;
}

/**
 * The blocking half of the verification report.
 *
 * The script ends with a second, informational SELECT (unowned operator audit
 * events, which are expected and fine). Only the `must_be_zero` rows gate the
 * contract step, so the informational set is dropped here rather than being
 * asserted against a threshold it was never meant to meet.
 */
const verifyReport = async (): Promise<VerifyRow[]> => {
  const all = await rows<Partial<VerifyRow>>(VERIFY);
  return all.filter((r): r is VerifyRow => r.must_be_zero !== undefined);
};

/** A database shaped like the product before ownership existed. */
const seedLegacy = async () => {
  harness = await createEmptyTestDb();
  await harness.exec(EXPAND_MIGRATIONS);
  await harness.exec(`
    INSERT INTO users (id, telegram_user_id, telegram_chat_id, username)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000001', '111', '111', 'alice'),
      ('bbbbbbbb-0000-4000-8000-000000000002', '222', '222', 'bob');

    -- Strategies already carry an owner (the column existed, nullable).
    INSERT INTO strategies (id, user_id, name, symbol, mode, enabled, config)
    VALUES
      ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       'Alice BTC', 'BTCUSDT', 'DRY_RUN', true, '{}'::jsonb),
      ('22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
       'Bob BTC', 'BTCUSDT', 'DRY_RUN', true, '{}'::jsonb);

    -- Orders and audit rows predate the owner column entirely.
    INSERT INTO orders (id, strategy_id, symbol, mode, side, quote_amount, price, status)
    VALUES
      ('33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
       'BTCUSDT', 'DRY_RUN', 'BUY', '100', '50000', 'COMPLETED'),
      ('44444444-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002',
       'BTCUSDT', 'DRY_RUN', 'BUY', '700', '50000', 'COMPLETED');

    INSERT INTO audit_events (id, entity_type, entity_id, action, payload)
    VALUES
      ('55555555-0000-4000-8000-000000000001', 'strategy',
       '11111111-0000-4000-8000-000000000001', 'SIGNAL_APPROVED', '{}'::jsonb),
      ('66666666-0000-4000-8000-000000000002', 'order',
       '44444444-0000-4000-8000-000000000002', 'DRY_RUN_ORDER_COMPLETED', '{}'::jsonb),
      ('77777777-0000-4000-8000-000000000003', 'user',
       'aaaaaaaa-0000-4000-8000-000000000001', 'USER_WEB_LOGIN', '{}'::jsonb),
      ('88888888-0000-4000-8000-000000000004', 'strategy',
       'ALL', 'ALL_STRATEGIES_PAUSED', '{}'::jsonb);
  `);
};

describe("001_backfill_ownership.sql", () => {
  it("derives each order's owner from its strategy", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);

    const orders = await rows<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM orders ORDER BY id",
    );
    expect(orders[0]?.user_id).toBe("aaaaaaaa-0000-4000-8000-000000000001");
    expect(orders[1]?.user_id).toBe("bbbbbbbb-0000-4000-8000-000000000002");
  });

  it("derives audit ownership through strategy, order and user entities", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);

    const events = await rows<{ id: string; user_id: string | null }>(
      "SELECT id, user_id FROM audit_events ORDER BY id",
    );
    const byId = Object.fromEntries(
      events.map((e) => [e.id.slice(0, 8), e.user_id]),
    );

    expect(byId["55555555"]).toBe("aaaaaaaa-0000-4000-8000-000000000001"); // via strategy
    expect(byId["66666666"]).toBe("bbbbbbbb-0000-4000-8000-000000000002"); // via order
    expect(byId["77777777"]).toBe("aaaaaaaa-0000-4000-8000-000000000001"); // via user
  });

  it("leaves install-wide audit events unowned rather than guessing", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);

    const [row] = await rows<{ user_id: string | null }>(
      "SELECT user_id FROM audit_events WHERE entity_id = 'ALL'",
    );
    // A pause that affected everyone belongs to nobody in particular.
    expect(row?.user_id).toBeNull();
  });

  it("is idempotent — a second run changes nothing", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    const first = await rows<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM orders ORDER BY id",
    );

    await harness.exec(BACKFILL);
    const second = await rows<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM orders ORDER BY id",
    );

    expect(second).toEqual(first);
  });

  it("never invents an owner for a strategy that has none", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO strategies (id, user_id, name, symbol, mode, enabled, config)
      VALUES ('99999999-0000-4000-8000-000000000009', NULL, 'Orphan', 'ETHUSDT',
              'DRY_RUN', true, '{}'::jsonb);
    `);
    await harness.exec(BACKFILL);

    const [orphan] = await rows<{ user_id: string | null }>(
      "SELECT user_id FROM strategies WHERE name = 'Orphan'",
    );
    // Assigning this to "the first user" would hand someone a stranger's bot.
    expect(orphan?.user_id).toBeNull();
  });
});

describe("002_verify_ownership.sql", () => {
  it("reports zero unresolved rows after a clean backfill", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);

    const report = await verifyReport();
    expect(report.length).toBeGreaterThan(0);
    for (const row of report) {
      expect({ [row.category]: Number(row.must_be_zero) }).toEqual({
        [row.category]: 0,
      });
    }
  });

  it("counts an ownerless strategy", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO strategies (user_id, name, symbol, mode, enabled, config)
      VALUES (NULL, 'Orphan', 'ETHUSDT', 'DRY_RUN', true, '{}'::jsonb);
    `);
    await harness.exec(BACKFILL);

    const report = await verifyReport();
    const strategies = report.find((r) =>
      r.category.includes("strategies without an owner"),
    );
    expect(Number(strategies?.must_be_zero)).toBe(1);
  });

  it("counts an order pointing at a strategy that no longer exists", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO orders (strategy_id, symbol, mode, side, quote_amount, price, status)
      VALUES ('dddddddd-0000-4000-8000-00000000000d', 'BTCUSDT', 'DRY_RUN', 'BUY',
              '10', '50000', 'COMPLETED');
    `);
    await harness.exec(BACKFILL);

    const report = await verifyReport();
    const orphans = report.find((r) =>
      r.category.includes("strategy that does not exist"),
    );
    expect(Number(orphans?.must_be_zero)).toBe(1);
  });

  it("counts an owned order with no accountable strategy", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO orders (user_id, strategy_id, symbol, mode, side, quote_amount, price, status)
      VALUES ('aaaaaaaa-0000-4000-8000-000000000001', NULL, 'BTCUSDT', 'DRY_RUN',
              'BUY', '10', '50000', 'COMPLETED');
    `);
    await harness.exec(BACKFILL);

    const report = await verifyReport();
    const withoutStrategy = report.find((r) =>
      r.category.includes("orders without a strategy"),
    );
    expect(Number(withoutStrategy?.must_be_zero)).toBe(1);
  });

  it("counts duplicate (user_id, symbol) pairs that the unique index would reject", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO strategies (user_id, name, symbol, mode, enabled, config)
      VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice BTC again', 'BTCUSDT',
              'DRY_RUN', true, '{}'::jsonb);
    `);
    await harness.exec(BACKFILL);

    const report = await verifyReport();
    const dupes = report.find((r) => r.category.includes("duplicate"));
    expect(Number(dupes?.must_be_zero)).toBe(1);
  });
});

describe("003_contract_ownership.sql", () => {
  it("refuses to run while an ownerless strategy exists", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO strategies (user_id, name, symbol, mode, enabled, config)
      VALUES (NULL, 'Orphan', 'ETHUSDT', 'DRY_RUN', true, '{}'::jsonb);
    `);
    await harness.exec(BACKFILL);

    // The guard exists so that skipping the verification step fails loudly
    // rather than contracting constraints over ambiguous data.
    await expect(harness.exec(CONTRACT)).rejects.toThrow(
      /OWNERSHIP_CONTRACT_PREFLIGHT_FAILED/,
    );
  });

  it("refuses to run while an ownerless order exists", async () => {
    await seedLegacy();
    await harness.exec(`
      INSERT INTO orders (strategy_id, symbol, mode, side, quote_amount, price, status)
      VALUES (NULL, 'BTCUSDT', 'DRY_RUN', 'BUY', '10', '50000', 'COMPLETED');
    `);
    await harness.exec(BACKFILL);

    await expect(harness.exec(CONTRACT)).rejects.toThrow(
      /OWNERSHIP_CONTRACT_PREFLIGHT_FAILED/,
    );
  });

  it("applies cleanly once the backfill has resolved everything", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    const columns = await rows<{ table_name: string; is_nullable: string }>(
      `SELECT table_name, is_nullable FROM information_schema.columns
       WHERE column_name = 'user_id' AND table_name IN ('strategies','orders')
       ORDER BY table_name`,
    );
    expect(columns).toEqual([
      { table_name: "orders", is_nullable: "NO" },
      { table_name: "strategies", is_nullable: "NO" },
    ]);
  });

  it("keeps audit ownership nullable so operator events remain expressible", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    const [col] = await rows<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'audit_events' AND column_name = 'user_id'`,
    );
    expect(col?.is_nullable).toBe("YES");
  });

  it("makes a second strategy for the same user and symbol impossible", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    // This is the constraint that turns "A and B both run BTCUSDT safely"
    // from a property of the current queries into a property of the database.
    await expect(
      harness.exec(`
        INSERT INTO strategies (user_id, name, symbol, mode, enabled, config)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Dupe', 'BTCUSDT',
                'DRY_RUN', true, '{}'::jsonb);
      `),
    ).rejects.toThrow();
  });

  it("still allows two different users to hold the same symbol", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    const [count] = await rows<{ n: string }>(
      "SELECT count(*) AS n FROM strategies WHERE symbol = 'BTCUSDT'",
    );
    expect(Number(count?.n)).toBe(2);
  });

  it("rejects an order whose strategy does not exist once the FK is in place", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    await expect(
      harness.exec(`
        INSERT INTO orders (user_id, strategy_id, symbol, mode, side, quote_amount, price, status)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000001',
                'dddddddd-0000-4000-8000-00000000000d',
                'BTCUSDT', 'DRY_RUN', 'BUY', '10', '50000', 'COMPLETED');
      `),
    ).rejects.toThrow();
  });
});

describe("cross-owner integrity after the contract", () => {
  it("rejects an order whose owner differs from its strategy's owner", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    await expect(
      harness.exec(`
        INSERT INTO orders (user_id, strategy_id, symbol, mode, side, quote_amount, price, status)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000001',
                '22222222-0000-4000-8000-000000000002',
                'BTCUSDT', 'DRY_RUN', 'BUY', '10', '50000', 'COMPLETED');
      `),
    ).rejects.toThrow();
  });
});

describe("DRY_RUN contract", () => {
  it("rejects persisted strategy modes outside DRY_RUN", async () => {
    await seedLegacy();
    await harness.exec(BACKFILL);
    await harness.exec(CONTRACT);

    await expect(
      harness.exec(`
        INSERT INTO strategies (user_id, name, symbol, mode, enabled, config)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Unsafe', 'ETHUSDT',
                'LIVE', false, '{}'::jsonb);
      `),
    ).rejects.toThrow();
  });
});
