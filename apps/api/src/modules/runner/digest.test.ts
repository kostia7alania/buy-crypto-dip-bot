import { schema } from "@buy-crypto-dip-bot/db";
import type {
  TestDatabase,
  TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { createTestDb, seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "../../db.js";

// The morning digest tells one person what happened to their money. Before
// ownership existed it aggregated every order in the install and sent a single
// message to one configured chat — which would have told each user everybody
// else's activity the moment a second person signed up.

vi.mock("@buy-crypto-dip-bot/exchange-bybit", () => ({
  createBybitPublicClient: () => ({
    getTicker: async (symbol: string) => ({
      symbol,
      lastPrice: 100_000,
      high24h: 110_000,
      low24h: 90_000,
      sourceAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    }),
    getKlines: async () => ({
      candles: [],
      sourceAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    }),
  }),
}));

let harness: TestDatabase;
let world: TwoTenantWorld;

// PGlite and node-postgres produce structurally identical Drizzle databases
// but distinct nominal types, so the seam needs one cast. It is confined to
// this line rather than leaking a loose type into the tests.
vi.mock("../../db.js", () => ({
  getDb: () => harness.db as unknown as ReturnType<typeof getDb>,
}));

const { buildDigestRenderInputsForUser } = await import("./runner.service.js");

const db = () => harness.db as unknown as ReturnType<typeof getDb>;

beforeEach(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
}, 60_000);

afterEach(async () => {
  await harness?.close();
});

describe("buildDigestRenderInputsForUser", () => {
  it("counts only the caller's own spend", async () => {
    const inputs = await buildDigestRenderInputsForUser(
      db(),
      world.alice.userId,
    );

    expect(inputs).not.toBeNull();
    // Alice spent 100 and Bob 700. A global aggregate would say 800.
    expect(inputs?.spent24hUsdt).toBe(100);
  });

  it("gives each tenant a different digest", async () => {
    const alice = await buildDigestRenderInputsForUser(
      db(),
      world.alice.userId,
    );
    const bob = await buildDigestRenderInputsForUser(db(), world.bob.userId);

    expect(alice?.spent24hUsdt).toBe(100);
    expect(bob?.spent24hUsdt).toBe(700);
  });

  it("reports one buy each, not the install's total", async () => {
    const alice = await buildDigestRenderInputsForUser(
      db(),
      world.alice.userId,
    );
    expect(alice?.buyCount).toBe(1);
  });

  it("returns nothing for a user with no activity and no portfolio", async () => {
    const [newcomer] = await harness.db
      .insert(schema.users)
      .values({
        telegramUserId: "3000003",
        telegramChatId: "3000003",
        username: "carol",
      })
      .returning();

    // Waking someone at 06:00 to tell them nothing happened is not a feature.
    const inputs = await buildDigestRenderInputsForUser(
      db(),
      newcomer?.id as string,
    );
    expect(inputs).toBeNull();
  });

  it("never mentions another tenant's symbols", async () => {
    // Bob holds SOLUSDT; Alice does not.
    await harness.db.insert(schema.orders).values({
      userId: world.bob.userId,
      strategyId: world.bob.ownSymbolStrategyId,
      symbol: "SOLUSDT",
      mode: "DRY_RUN",
      side: "BUY",
      quoteAmount: "50",
      price: "200",
      status: "COMPLETED",
    });

    const alice = await buildDigestRenderInputsForUser(
      db(),
      world.alice.userId,
    );
    expect(alice?.dips.map((dip) => dip.symbol)).not.toContain("SOLUSDT");
  });

  it("excludes orders older than the 24h window", async () => {
    await harness.db.insert(schema.orders).values({
      userId: world.alice.userId,
      strategyId: world.alice.sharedSymbolStrategyId,
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      side: "BUY",
      quoteAmount: "999",
      price: "50000",
      status: "COMPLETED",
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });

    const inputs = await buildDigestRenderInputsForUser(
      db(),
      world.alice.userId,
    );
    // The stale 999 must not appear in the 24h spend line.
    expect(inputs?.spent24hUsdt).toBe(100);
  });

  it("reports a portfolio for a user whose only buys are older than a day", async () => {
    const [holder] = await harness.db
      .insert(schema.users)
      .values({
        telegramUserId: "4000004",
        telegramChatId: "4000004",
        username: "dave",
      })
      .returning();
    const [strategy] = await harness.db
      .insert(schema.strategies)
      .values({
        userId: holder?.id as string,
        name: "Dave BTC",
        symbol: "BTCUSDT",
        mode: "DRY_RUN",
        enabled: true,
        config: {},
      })
      .returning();
    await harness.db.insert(schema.orders).values({
      userId: holder?.id as string,
      strategyId: strategy?.id as string,
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      side: "BUY",
      quoteAmount: "250",
      price: "50000",
      status: "COMPLETED",
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    });

    // Nothing bought today, but they still hold something worth reporting.
    const inputs = await buildDigestRenderInputsForUser(
      db(),
      holder?.id as string,
    );
    expect(inputs).not.toBeNull();
    expect(inputs?.portfolio?.investedUsdt).toBe(250);
  });
});
