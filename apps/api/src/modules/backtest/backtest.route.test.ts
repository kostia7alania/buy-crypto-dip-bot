import type { Candle, KlineSnapshot } from "@buy-crypto-dip-bot/exchange-core";
import { runDipBacktest } from "@buy-crypto-dip-bot/strategy-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BacktestResponse } from "./backtest.route.js";

const market = vi.hoisted(() => ({ klines: vi.fn() }));
vi.mock("@buy-crypto-dip-bot/exchange-bybit", () => ({
  createBybitPublicClient: () => ({ getKlines: market.klines }),
}));

const HOUR_MS = 3_600_000;
const NOW = Date.parse("2026-10-03T12:59:00Z");
const LAST_CLOSED = Date.parse("2026-10-03T11:00:00Z");
const history = (count = 193, last = LAST_CLOSED): Candle[] =>
  Array.from({ length: count }, (_, index) => ({
    openTime: last - (count - 1 - index) * HOUR_MS,
    open: 100,
    high: 110,
    low: 90,
    close: 100 + (index % 5),
  }));
const snapshot = (candles: Candle[], sourceAt = NOW): KlineSnapshot => ({
  candles,
  sourceAt: new Date(sourceAt).toISOString(),
  receivedAt: new Date(sourceAt).toISOString(),
  ageMs: 0,
  ttlMs: 30_000,
});
const routes = async () => (await import("./backtest.route.js")).backtestRoutes;

beforeEach(() => {
  vi.resetModules();
  market.klines.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("ALLOWLIST_SYMBOLS", "BTCUSDT");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("backtest disclosure", () => {
  it("reports consumed closed history and the existing equal-capital schedule without changing results", async () => {
    const candles = history();
    const source = snapshot(candles);
    market.klines.mockResolvedValue(source);

    const response = await (await routes()).request("/?days=7");
    expect(response.status).toBe(200);
    const body: BacktestResponse = await response.json();
    const original = runDipBacktest(candles, body.config);
    if (!original) throw new Error("EXPECTED_BACKTEST_RESULT");
    expect(body).toMatchObject({
      ...original,
      trades: original.trades.slice(-20),
      tradeCount: original.trades.length,
      history: {
        status: "COMPLETE",
        issues: [],
        expectedCandles: 193,
        receivedCandles: 193,
        warmupCandles: 24,
        replayCandles: 169,
        inputStartAt: LAST_CLOSED - 192 * HOUR_MS,
        inputEndAt: LAST_CLOSED,
        replayStartAt: LAST_CLOSED - 168 * HOUR_MS,
        replayEndAt: LAST_CLOSED,
        missingHours: 0,
        unconfirmedCandles: 0,
      },
      provenance: {
        source: "BYBIT_SPOT",
        interval: "60",
        pages: [{ sourceAt: source.sourceAt, receivedAt: source.receivedAt }],
        cacheHit: false,
        cacheAgeMs: 0,
      },
      methodology: {
        fees: "NOT_MODELLED",
        slippage: "NOT_MODELLED",
        benchmarkCapitalUsdt: original.spentUsdt,
        benchmarkSampleTimes: Array.from(
          { length: 8 },
          (_, index) => LAST_CLOSED - (7 - index) * 24 * HOUR_MS,
        ),
        dcaAmountUsdt: original.spentUsdt / 8,
      },
    });
    expect(body.benchmarks?.hold.qty).toBe(original.spentUsdt / 104);
  });

  it("keeps a full-count but gappy replay incomplete and reports a short source window honestly", async () => {
    const candles = history();
    // Keep the requested count while omitting an hour inside the warm-up.
    for (const candle of candles.slice(0, 12)) candle.openTime -= HOUR_MS;
    market.klines.mockResolvedValueOnce(snapshot(candles));
    const app = await routes();
    const gappy: BacktestResponse = await (
      await app.request("/?days=7")
    ).json();
    expect(gappy.history).toMatchObject({
      status: "INCOMPLETE",
      issues: ["MISSING_HOURS"],
      receivedCandles: 193,
      expectedCandles: 193,
      missingHours: 1,
    });

    market.klines.mockResolvedValueOnce(snapshot(history(50)));
    const short: BacktestResponse = await (
      await app.request("/?days=8")
    ).json();
    expect(short.history).toMatchObject({
      status: "INCOMPLETE",
      issues: ["SHORT_HISTORY"],
      receivedCandles: 50,
      expectedCandles: 217,
      replayCandles: 26,
      replayStartAt: LAST_CLOSED - 25 * HOUR_MS,
      replayEndAt: LAST_CLOSED,
    });
  });

  it("does not promote an open candle to closed after the clock advances on a cache hit", async () => {
    market.klines.mockResolvedValue(
      snapshot(history(193, LAST_CLOSED + HOUR_MS)),
    );
    const app = await routes();
    const first: BacktestResponse = await (
      await app.request("/?days=7")
    ).json();
    expect(first.history).toMatchObject({
      status: "INCOMPLETE",
      issues: ["UNCONFIRMED_CLOSE"],
      unconfirmedCandles: 1,
    });

    vi.setSystemTime(NOW + 2 * 60_000);
    const cached: BacktestResponse = await (
      await app.request("/?days=7&threshold=2")
    ).json();
    expect(market.klines).toHaveBeenCalledTimes(1);
    expect(cached.history).toEqual(first.history);
    expect(cached.provenance).toEqual({
      ...first.provenance,
      cacheHit: true,
      cacheAgeMs: 120_000,
    });
  });

  it("retains each page clock and the trimmed input bounds across a paginated hour boundary", async () => {
    const candles = history(2000, LAST_CLOSED + HOUR_MS);
    market.klines
      .mockResolvedValueOnce(snapshot(candles.slice(1000)))
      .mockImplementationOnce(async () => {
        vi.setSystemTime(NOW + 2 * 60_000);
        return snapshot(candles.slice(0, 1000), Date.now());
      });
    const body: BacktestResponse = await (
      await (await routes()).request("/?days=60")
    ).json();
    expect(market.klines).toHaveBeenCalledTimes(2);
    expect(market.klines).toHaveBeenLastCalledWith({
      symbol: "BTCUSDT",
      interval: "60",
      limit: 1000,
      end: LAST_CLOSED - 998 * HOUR_MS - 1,
    });
    expect(body.history).toMatchObject({
      status: "INCOMPLETE",
      issues: ["UNCONFIRMED_CLOSE"],
      receivedCandles: 1465,
      inputStartAt: LAST_CLOSED - 1463 * HOUR_MS,
      inputEndAt: LAST_CLOSED + HOUR_MS,
      replayStartAt: LAST_CLOSED - 1439 * HOUR_MS,
      unconfirmedCandles: 1,
    });
    expect(body.provenance.pages.map((page) => page.sourceAt)).toEqual([
      new Date(NOW).toISOString(),
      new Date(NOW + 120_000).toISOString(),
    ]);
  });

  it("does not call old or unclocked history complete just because its count is sufficient", async () => {
    market.klines.mockResolvedValueOnce(
      snapshot(history(193, LAST_CLOSED - HOUR_MS)),
    );
    const app = await routes();
    const stale: BacktestResponse = await (
      await app.request("/?days=7")
    ).json();
    expect(stale.history).toMatchObject({
      status: "INCOMPLETE",
      issues: ["STALE_HISTORY"],
    });

    market.klines.mockResolvedValueOnce({
      ...snapshot(history(217)),
      sourceAt: "invalid",
    });
    const unclocked: BacktestResponse = await (
      await app.request("/?days=8")
    ).json();
    expect(unclocked.history).toMatchObject({
      status: "INCOMPLETE",
      issues: ["UNKNOWN_SOURCE_TIME", "UNCONFIRMED_CLOSE"],
      unconfirmedCandles: 217,
    });
  });

  it("returns an explicit incomplete error instead of financial output for invalid input", async () => {
    const candles = history().map((candle, index) => ({
      ...candle,
      close: index === 30 ? Number.NaN : candle.close,
      openTime: candle.openTime - (index === 31 ? HOUR_MS : 0),
    }));
    market.klines.mockResolvedValueOnce(snapshot(candles));
    const app = await routes();
    const response = await app.request("/?days=7");
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({
      error: "INVALID_HISTORY",
      history: {
        status: "INCOMPLETE",
        issues: expect.arrayContaining([
          "INVALID_CANDLES",
          "IRREGULAR_TIMESTAMPS",
        ]),
      },
    });
    expect(body).not.toHaveProperty("pnlUsdt");

    market.klines.mockResolvedValueOnce(snapshot(history(24)));
    const tooShort = await app.request("/?days=8");
    expect(tooShort.status).toBe(400);
    expect(await tooShort.json()).toMatchObject({
      error: "NOT_ENOUGH_HISTORY",
      history: { status: "INCOMPLETE", replayStartAt: null, replayCandles: 0 },
    });

    market.klines.mockRejectedValueOnce(
      Object.assign(new Error("BYBIT_PUBLIC_DATA_INVALID_CANDLE"), {
        code: "INVALID_CANDLE",
      }),
    );
    const rejected = await app.request("/?days=9");
    expect(rejected.status).toBe(502);
    expect(await rejected.json()).toEqual({
      error: "INVALID_HISTORY",
      history: { status: "INCOMPLETE" },
    });
  });
});
