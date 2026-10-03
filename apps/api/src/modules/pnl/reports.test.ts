import { schema } from "@buy-crypto-dip-bot/db";
import {
  createTestDb,
  seedTwoTenants,
  type TestDatabase,
  type TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import type {
  KlineQuery,
  MarketTicker,
} from "@buy-crypto-dip-bot/exchange-core";
import type {
  PerformanceReport,
  PnlReport,
} from "@buy-crypto-dip-bot/shared-types";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { getDb } from "../../db.js";

const market = vi.hoisted(() => ({ ticker: vi.fn(), klines: vi.fn() }));
vi.mock("@buy-crypto-dip-bot/exchange-bybit", () => ({
  createBybitPublicClient: () => ({
    getTicker: market.ticker,
    getKlines: market.klines,
  }),
}));
let harness: TestDatabase;
let world: TwoTenantWorld;
let token: string;
let emptyToken: string;
vi.mock("../../db.js", () => ({
  getDb: () => harness.db as unknown as ReturnType<typeof getDb>,
}));

const { createApp } = await import("../../app.js");
const { issueSession } = await import("../auth/session.repository.js");
const { buildDigestRenderInputsForUser } = await import(
  "../runner/runner.service.js"
);
const { renderTelegramTemplate } = await import(
  "../notifications/telegram-template.js"
);
const DAY_MS = 86_400_000;
const freshness = () => ({
  sourceAt: new Date().toISOString(),
  receivedAt: new Date().toISOString(),
  ageMs: 0,
  ttlMs: 30_000,
});
const ticker = (symbol: string): MarketTicker => ({
  symbol,
  lastPrice: 100,
  high24h: 110,
  low24h: 90,
  ...freshness(),
});
const appDb = () => harness.db as unknown as ReturnType<typeof getDb>;
const request = (path: string, session = token) =>
  createApp().request(path, { headers: { "x-user-session": session } });

beforeAll(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
  token = (await issueSession(appDb(), world.alice.userId)).token;
  const [emptyUser] = await harness.db
    .insert(schema.users)
    .values({ telegramUserId: "report-empty" })
    .returning();
  if (!emptyUser) throw new Error("TEST_USER_REQUIRED");
  emptyToken = (await issueSession(appDb(), emptyUser.id)).token;
  await harness.db.insert(schema.orders).values({
    userId: world.alice.userId,
    strategyId: world.alice.ownSymbolStrategyId,
    symbol: "ETHUSDT",
    mode: "DRY_RUN",
    side: "BUY",
    status: "COMPLETED",
    price: "100",
    quoteAmount: "50",
    createdAt: new Date(Date.now() - 2 * DAY_MS),
  });
}, 60_000);
afterAll(async () => {
  await harness?.close();
});
beforeEach(() => {
  market.ticker
    .mockReset()
    .mockImplementation(async (symbol: string) => ticker(symbol));
  market.klines.mockReset().mockImplementation(async (query: KlineQuery) => ({
    ...freshness(),
    candles: Array.from({ length: query.limit ?? 0 }, (_, index) => ({
      openTime:
        (query.end as number) + 1 - ((query.limit as number) - index) * DAY_MS,
      open: 100,
      high: 110,
      low: 90,
      close: 100,
    })),
  }));
});

describe("truthful incomplete reports", () => {
  it("retains an unavailable position and all owned spend, sharing each quote once per dashboard request", async () => {
    market.ticker.mockImplementation(async (symbol: string) => {
      if (symbol === "BTCUSDT") throw new Error("provider unavailable");
      return ticker(symbol);
    });
    const response = await request("/dashboard/snapshot");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      pnl: PnlReport;
      performance: PerformanceReport;
    };
    expect(body.pnl.status).toBe("PARTIAL");
    expect(body.pnl.totals).toEqual({
      spentUsdt: 150,
      currentValueUsdt: null,
      pnlUsdt: null,
      pnlPercent: null,
    });
    expect(body.pnl.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "BTCUSDT",
          spentUsdt: 100,
          currentPrice: null,
          issue: "MARKET_UNAVAILABLE",
        }),
        expect.objectContaining({
          symbol: "ETHUSDT",
          spentUsdt: 50,
          currentValueUsdt: 50,
          issue: null,
        }),
      ]),
    );
    expect(body.performance.status).toBe("PARTIAL");
    expect(
      body.performance.positions.find((p) => p.symbol === "BTCUSDT"),
    ).toMatchObject({ actual: null, calendarDca: null, hold: null });
    const available = body.performance.positions.find(
      (p) => p.symbol === "ETHUSDT",
    );
    expect(available).toMatchObject({
      issue: null,
      window: { candles: 2 },
      actual: { valueUsdt: 50 },
    });
    expect(available?.quote).toEqual(
      body.pnl.positions.find((p) => p.symbol === "ETHUSDT")?.quote,
    );
    expect(market.ticker.mock.calls.map(([symbol]) => symbol).sort()).toEqual([
      "BTCUSDT",
      "ETHUSDT",
    ]);
    expect(JSON.stringify(body)).not.toContain(world.bob.userId);
    expect(body.pnl.assumptions).toEqual({
      mode: "DRY_RUN",
      fees: "NOT_MODELLED",
      slippage: "NOT_MODELLED",
    });

    const digest = await buildDigestRenderInputsForUser(
      appDb(),
      world.alice.userId,
    );
    expect(digest?.portfolio).toEqual({
      investedUsdt: 150,
      currentValueUsdt: null,
      pnlUsdt: null,
      pnlPercent: null,
    });
    const rendered = renderTelegramTemplate({
      version: 1,
      key: "DAILY_DIGEST",
      inputs: digest,
    });
    expect(rendered.text).toContain("valuation unavailable");
    expect(rendered.text).toContain("150.00 USDT");
    expect(rendered.text).not.toContain("now <code>0.00");
  });

  it("never turns a total quote outage into empty holdings or zero valuation", async () => {
    market.ticker.mockRejectedValue(new Error("offline"));
    const pnl = (await (await request("/pnl")).json()) as PnlReport;
    const performance = (await (
      await request("/performance")
    ).json()) as PerformanceReport;
    expect(pnl).toMatchObject({
      status: "UNAVAILABLE",
      totals: { spentUsdt: 150, currentValueUsdt: null, pnlUsdt: null },
    });
    expect(pnl.positions).toHaveLength(2);
    expect(performance.status).toBe("UNAVAILABLE");
    expect(performance.positions).toHaveLength(2);
    expect(
      performance.positions.every(
        (p) => p.actual === null && p.issue === "MARKET_UNAVAILABLE",
      ),
    ).toBe(true);
  });

  it("marks stale quotes unavailable instead of computing with them", async () => {
    market.ticker.mockImplementation(async (symbol: string) => ({
      ...ticker(symbol),
      sourceAt: new Date(Date.now() - 60_000).toISOString(),
    }));
    const body = (await (await request("/pnl")).json()) as PnlReport;
    expect(body.status).toBe("UNAVAILABLE");
    expect(
      body.positions.every(
        (p) => p.issue === "STALE_MARKET" && p.currentPrice === null,
      ),
    ).toBe(true);
    expect(body.totals.pnlPercent).toBeNull();
  });

  it("revalidates earlier symbols at final assembly and shares the dashboard cutoff without refetching", async () => {
    // Both seeded holdings have closed days; only the clock, not DB timers, is fake.
    const startedAt = Date.now() + 2 * DAY_MS;
    const getKlines = market.klines.getMockImplementation();
    if (!getKlines) throw new Error("TEST_KLINES_REQUIRED");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(startedAt);
      const session = (await issueSession(appDb(), world.alice.userId)).token;
      for (const [path, delayedSource] of [
        ["/pnl", "ticker"],
        ["/performance", "ticker"],
        ["/dashboard/snapshot", "ticker"],
        ["/dashboard/snapshot", "history"],
      ] as const) {
        vi.setSystemTime(startedAt);
        let quotes = 0;
        let histories = 0;
        market.ticker.mockReset().mockImplementation(async (symbol: string) => {
          if (++quotes === 2 && delayedSource === "ticker") {
            vi.setSystemTime(startedAt + 31_001);
          }
          return ticker(symbol);
        });
        market.klines
          .mockReset()
          .mockImplementation(async (query: KlineQuery) => {
            if (++histories === 2 && delayedSource === "history") {
              vi.setSystemTime(startedAt + 31_001);
            }
            return getKlines(query);
          });

        const response = await request(path, session);
        expect(response.status).toBe(200);
        const body = await response.json();
        const pnl: PnlReport | undefined = path === "/pnl" ? body : body.pnl;
        const performance: PerformanceReport | undefined =
          path === "/performance" ? body : body.performance;
        const cutoff = new Date(startedAt + 31_001).toISOString();
        const status = delayedSource === "ticker" ? "PARTIAL" : "UNAVAILABLE";
        const expiredSymbol = market.ticker.mock.calls[0]?.[0];
        expect(market.ticker).toHaveBeenCalledTimes(2);
        expect(
          market.ticker.mock.calls.map(([symbol]) => symbol).sort(),
        ).toEqual(["BTCUSDT", "ETHUSDT"]);
        if (pnl) {
          expect(pnl.generatedAt).toBe(cutoff);
          expect(pnl.status).toBe(status);
          expect(
            pnl.positions.find((p) => p.symbol === expiredSymbol),
          ).toMatchObject({
            issue: "STALE_MARKET",
            currentPrice: null,
            currentValueUsdt: null,
            pnlUsdt: null,
            pnlPercent: null,
          });
          expect(pnl.totals).toEqual({
            spentUsdt: 150,
            currentValueUsdt: null,
            pnlUsdt: null,
            pnlPercent: null,
          });
        }
        if (performance) {
          expect(performance.generatedAt).toBe(cutoff);
          expect(performance.status).toBe(status);
          expect(
            performance.positions.find((p) => p.symbol === expiredSymbol),
          ).toMatchObject({
            issue: "STALE_MARKET",
            currentPrice: null,
            actual: null,
            calendarDca: null,
            hold: null,
          });
        }
        if (path === "/dashboard/snapshot") {
          expect(body.generatedAt).toBe(cutoff);
          expect(pnl?.generatedAt).toBe(performance?.generatedAt);
          expect(pnl?.positions.map((p) => [p.symbol, p.currentPrice])).toEqual(
            performance?.positions.map((p) => [p.symbol, p.currentPrice]),
          );
        }
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps non-comparable positions when historical candles are missing", async () => {
    market.klines.mockResolvedValue({ ...freshness(), candles: [] });
    const body = (await (
      await request("/performance")
    ).json()) as PerformanceReport;
    expect(body.status).toBe("UNAVAILABLE");
    expect(body.positions).toHaveLength(2);
    expect(
      body.positions.every(
        (p) => p.issue === "INCOMPLETE_HISTORY" && p.calendarDca === null,
      ),
    ).toBe(true);
    expect(body.positions.reduce((sum, p) => sum + p.spentUsdt, 0)).toBe(150);
  });

  it("distinguishes a genuinely empty owner from a provider outage", async () => {
    market.ticker.mockRejectedValue(new Error("offline"));
    const body = (await (
      await request("/pnl", emptyToken)
    ).json()) as PnlReport;
    expect(body).toMatchObject({
      status: "EMPTY",
      positions: [],
      totals: { spentUsdt: 0, currentValueUsdt: 0, pnlUsdt: 0 },
    });
    expect(market.ticker).not.toHaveBeenCalled();
  });
});
