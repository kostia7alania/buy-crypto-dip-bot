import { schema } from "@buy-crypto-dip-bot/db";
import {
  createTestDb,
  seedTwoTenants,
  type TestDatabase,
  type TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { getDb } from "../../db.js";

let harness: TestDatabase;
let world: TwoTenantWorld;
let token: string;
const exchange = vi.hoisted(() => ({ getTicker: vi.fn(), getKlines: vi.fn() }));
vi.mock("../../db.js", () => ({
  getDb: () => harness.db as unknown as ReturnType<typeof getDb>,
}));
vi.mock("@buy-crypto-dip-bot/exchange-bybit", () => ({
  createBybitPublicClient: () => exchange,
}));
const { createApp } = await import("../../app.js");
const { issueSession } = await import("../auth/session.repository.js");

beforeAll(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
  token = (
    await issueSession(
      harness.db as unknown as ReturnType<typeof getDb>,
      world.alice.userId,
    )
  ).token;
}, 60_000);
afterAll(async () => {
  await harness?.close();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("symbol policy at API boundaries", () => {
  it.each([
    "PEPEUSDT",
    "SHIBUSDT",
    "DOGEUSDT",
  ])("rejects %s creation and backtests before exchange access", async (symbol) => {
    const app = createApp();
    const created = await app.request("/strategies", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-session": token },
      body: JSON.stringify({ symbol }),
    });
    expect(created.status).toBe(400);
    expect(await created.json()).toEqual({ error: "SYMBOL_NOT_ALLOWED" });
    const backtest = await app.request(`/backtest?symbol=${symbol}`, {
      headers: { "x-user-session": token },
    });
    expect(backtest.status).toBe(400);
    expect(await backtest.json()).toEqual({ error: "SYMBOL_NOT_ALLOWED" });
    expect(exchange.getTicker).not.toHaveBeenCalled();
    expect(exchange.getKlines).not.toHaveBeenCalled();
    expect(
      await harness.db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.symbol, symbol)),
    ).toHaveLength(0);
  });

  it("does not reveal or authorize an unsupported pair stored by another tenant", async () => {
    const app = createApp();
    const before = await app.request("/market/PEPEUSDT/ticker");
    const [legacy] = await harness.db
      .insert(schema.strategies)
      .values({
        userId: world.bob.userId,
        name: "Legacy unsupported pair",
        symbol: "PEPEUSDT",
        mode: "DRY_RUN",
        enabled: false,
        config: {},
      })
      .returning();
    const after = await app.request("/market/PEPEUSDT/ticker");
    expect([before.status, after.status]).toEqual([400, 400]);
    expect(await before.json()).toEqual(await after.json());
    expect(exchange.getTicker).not.toHaveBeenCalled();
    const bobToken = (
      await issueSession(
        harness.db as unknown as ReturnType<typeof getDb>,
        world.bob.userId,
      )
    ).token;
    if (!legacy) throw new Error("Missing legacy strategy fixture");
    const enable = await app.request(`/strategies/${legacy.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-session": bobToken,
      },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enable.status).toBe(400);
    expect(await enable.json()).toEqual({ error: "SYMBOL_NOT_ALLOWED" });
  });

  it("keeps market access and risk status on the same narrowed policy", async () => {
    vi.stubEnv("ALLOWLIST_SYMBOLS", "ETHUSDT,PEPEUSDT");
    const app = createApp();
    const blocked = await app.request("/market/BTCUSDT/ticker");
    expect(blocked.status).toBe(400);
    const status = await app.request("/risk/status");
    expect(await status.json()).toMatchObject({ allowedSymbols: ["ETHUSDT"] });
    exchange.getTicker.mockResolvedValueOnce({
      symbol: "ETHUSDT",
      lastPrice: 100,
    });
    expect((await app.request("/market/ETHUSDT/ticker")).status).toBe(200);
    expect(exchange.getTicker).toHaveBeenCalledOnce();
    expect(exchange.getTicker).toHaveBeenCalledWith("ETHUSDT");
  });
});
