import { isAllowedSymbol, strategyDefaults } from "@buy-crypto-dip-bot/config";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import type { Candle } from "@buy-crypto-dip-bot/exchange-core";
import {
  type BacktestResult,
  runDipBacktest,
} from "@buy-crypto-dip-bot/strategy-engine";
import { Hono } from "hono";
import * as v from "valibot";
import { logApiError } from "../../operational-log.js";
import type { AppEnv } from "../auth/principal.middleware.js";
import {
  type BacktestHistory,
  describeBacktestHistory,
  type HistorySource,
} from "./backtest-history.js";

const querySchema = v.object({
  symbol: v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/)),
  days: v.pipe(v.number(), v.minValue(7), v.maxValue(120)),
  threshold: v.pipe(v.number(), v.minValue(0.1), v.maxValue(50)),
  amount: v.pipe(v.number(), v.minValue(1), v.maxValue(100000)),
  dailyCap: v.pipe(v.number(), v.minValue(1)),
  weeklyCap: v.pipe(v.number(), v.minValue(1)),
  cooldown: v.pipe(v.number(), v.minValue(0), v.maxValue(10080)),
});

interface CachedHistory {
  at: number;
  candles: Candle[];
  sources: HistorySource[];
}

// Retain source clocks: the latest cached candle may still be provisional.
const klineCache = new Map<string, CachedHistory>();
const KLINE_CACHE_MS = 10 * 60 * 1000;
const BYBIT_PAGE_LIMIT = 1000;

async function fetchHourlyCandles(
  symbol: string,
  days: number,
): Promise<CachedHistory & { cacheHit: boolean }> {
  const key = `${symbol}:${days}`;
  const hit = klineCache.get(key);
  if (hit && Date.now() - hit.at < KLINE_CACHE_MS) {
    return { ...hit, cacheHit: true };
  }

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });
  const needed = days * 24 + 25; // extra day for the first rolling high
  const pages: Candle[][] = [];
  const sources: HistorySource[] = [];
  let end: number | undefined;

  while (pages.reduce((n, p) => n + p.length, 0) < needed) {
    const snapshot = await client.getKlines({
      symbol,
      interval: "60",
      limit: BYBIT_PAGE_LIMIT,
      ...(end !== undefined ? { end } : {}),
    });
    sources.push({
      sourceAt: snapshot.sourceAt,
      receivedAt: snapshot.receivedAt,
    });
    const page = snapshot.candles;
    const first = page[0];
    if (!first) break;
    pages.push(page);
    // Next page: everything strictly before the oldest candle we have.
    end = first.openTime - 1;
    if (page.length < BYBIT_PAGE_LIMIT) break; // history exhausted
  }

  // Pages are newest-block-last-fetched; each page is chronological.
  const candles = pages.reverse().flat().slice(-needed);

  const history = { at: Date.now(), candles, sources };
  klineCache.set(key, history);
  return { ...history, cacheHit: false };
}

export interface BacktestResponse extends BacktestResult {
  symbol: string;
  days: number;
  // trades[] is truncated for transport; this is the real total.
  tradeCount: number;
  history: BacktestHistory;
  provenance: {
    source: "BYBIT_SPOT";
    interval: "60";
    pages: HistorySource[];
    fetchedAt: string;
    cacheHit: boolean;
    cacheAgeMs: number;
    cacheTtlMs: number;
  };
  methodology: {
    version: "HOURLY_CLOSE_EQUAL_CAPITAL_V1";
    fees: "NOT_MODELLED";
    slippage: "NOT_MODELLED";
    benchmarkCapitalUsdt: number;
    benchmarkSampleTimes: number[];
    dcaAmountUsdt: number | null;
  };
  config: {
    thresholdPercent: number;
    buyAmountUsdt: number;
    maxDailySpendUsdt: number;
    maxWeeklySpendUsdt: number;
    cooldownMinutes: number;
  };
}

export const backtestRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const q = c.req.query();
  const parsed = v.safeParse(querySchema, {
    symbol: (q.symbol ?? "BTCUSDT").toUpperCase(),
    days: Number(q.days ?? 30),
    threshold: Number(q.threshold ?? strategyDefaults.thresholdPercent),
    amount: Number(q.amount ?? strategyDefaults.suggestedQuoteAmount),
    dailyCap: Number(q.dailyCap ?? strategyDefaults.maxDailySpendUsdt),
    weeklyCap: Number(q.weeklyCap ?? strategyDefaults.maxWeeklySpendUsdt),
    cooldown: Number(q.cooldown ?? strategyDefaults.cooldownMinutes),
  });
  if (!parsed.success) {
    return c.json({ error: "INVALID_BACKTEST_PARAMS" }, 400);
  }
  const p = parsed.output;
  if (!isAllowedSymbol(p.symbol, process.env.ALLOWLIST_SYMBOLS)) {
    return c.json({ error: "SYMBOL_NOT_ALLOWED" }, 400);
  }

  try {
    const fetched = await fetchHourlyCandles(p.symbol, p.days);
    const { candles } = fetched;
    const history = describeBacktestHistory(candles, p.days, fetched.sources);
    if (
      history.issues.includes("INVALID_CANDLES") ||
      history.issues.includes("IRREGULAR_TIMESTAMPS")
    ) {
      return c.json({ error: "INVALID_HISTORY", history }, 502);
    }
    if (candles.length < 25) {
      return c.json({ error: "NOT_ENOUGH_HISTORY", history }, 400);
    }

    const config = {
      thresholdPercent: p.threshold,
      buyAmountUsdt: p.amount,
      maxDailySpendUsdt: p.dailyCap,
      maxWeeklySpendUsdt: p.weeklyCap,
      cooldownMinutes: p.cooldown,
    };
    const result = runDipBacktest(candles, config);
    if (!result) return c.json({ error: "NOT_ENOUGH_HISTORY" }, 400);

    const benchmarkSampleTimes = candles
      .filter((_, index) => index >= 24 && (index - 24) % 24 === 0)
      .map((candle) => candle.openTime);

    const response: BacktestResponse = {
      ...result,
      // Don't ship hundreds of trades to the client; the last 20 tell the story.
      trades: result.trades.slice(-20),
      tradeCount: result.trades.length,
      symbol: p.symbol,
      days: p.days,
      config,
      history,
      provenance: {
        source: "BYBIT_SPOT",
        interval: "60",
        pages: fetched.sources,
        fetchedAt: new Date(fetched.at).toISOString(),
        cacheHit: fetched.cacheHit,
        cacheAgeMs: Math.max(0, Date.now() - fetched.at),
        cacheTtlMs: KLINE_CACHE_MS,
      },
      methodology: {
        version: "HOURLY_CLOSE_EQUAL_CAPITAL_V1",
        fees: "NOT_MODELLED",
        slippage: "NOT_MODELLED",
        benchmarkCapitalUsdt: result.spentUsdt,
        benchmarkSampleTimes,
        dcaAmountUsdt: result.benchmarks
          ? result.spentUsdt / benchmarkSampleTimes.length
          : null,
      },
    };
    return c.json(response);
  } catch (error) {
    logApiError("BACKTEST_FAILED", error, c.get("correlationId"));
    if (
      error instanceof Error &&
      "code" in error &&
      [
        "INVALID_RESPONSE",
        "INVALID_NUMBER",
        "INVALID_CANDLE",
        "EMPTY_RESULT",
      ].includes(String(error.code))
    ) {
      return c.json(
        { error: "INVALID_HISTORY", history: { status: "INCOMPLETE" } },
        502,
      );
    }
    return c.json({ error: "BACKTEST_FAILED" }, 500);
  }
});
