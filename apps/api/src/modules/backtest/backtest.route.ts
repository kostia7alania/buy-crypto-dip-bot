import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import type { Candle } from "@buy-crypto-dip-bot/exchange-core";
import {
  type BacktestResult,
  runDipBacktest,
} from "@buy-crypto-dip-bot/strategy-engine";
import { Hono } from "hono";
import * as v from "valibot";

const querySchema = v.object({
  symbol: v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/)),
  days: v.pipe(v.number(), v.minValue(7), v.maxValue(120)),
  threshold: v.pipe(v.number(), v.minValue(0.1), v.maxValue(50)),
  amount: v.pipe(v.number(), v.minValue(1), v.maxValue(100000)),
  dailyCap: v.pipe(v.number(), v.minValue(1)),
  weeklyCap: v.pipe(v.number(), v.minValue(1)),
  cooldown: v.pipe(v.number(), v.minValue(0), v.maxValue(10080)),
});

// Historical prices don't change — cache klines per symbol/window briefly
// so repeated runs with different strategy knobs are instant and Bybit
// isn't hammered.
const klineCache = new Map<string, { at: number; candles: Candle[] }>();
const KLINE_CACHE_MS = 10 * 60 * 1000;
const BYBIT_PAGE_LIMIT = 1000;

async function fetchHourlyCandles(
  symbol: string,
  days: number,
): Promise<Candle[]> {
  const key = `${symbol}:${days}`;
  const hit = klineCache.get(key);
  if (hit && Date.now() - hit.at < KLINE_CACHE_MS) return hit.candles;

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });
  const needed = days * 24 + 25; // extra day for the first rolling high
  const pages: Candle[][] = [];
  let end: number | undefined;

  while (pages.reduce((n, p) => n + p.length, 0) < needed) {
    const page = await client.getKlines({
      symbol,
      interval: "60",
      limit: BYBIT_PAGE_LIMIT,
      ...(end !== undefined ? { end } : {}),
    });
    if (page.length === 0) break;
    pages.push(page);
    // Next page: everything strictly before the oldest candle we have.
    end = page[0]!.openTime - 1;
    if (page.length < BYBIT_PAGE_LIMIT) break; // history exhausted
  }

  // Pages are newest-block-last-fetched; each page is chronological.
  const candles = pages.reverse().flat().slice(-needed);

  klineCache.set(key, { at: Date.now(), candles });
  return candles;
}

export interface BacktestResponse extends BacktestResult {
  symbol: string;
  days: number;
  // trades[] is truncated for transport; this is the real total.
  tradeCount: number;
  config: {
    thresholdPercent: number;
    buyAmountUsdt: number;
    maxDailySpendUsdt: number;
    maxWeeklySpendUsdt: number;
    cooldownMinutes: number;
  };
}

export const backtestRoutes = new Hono().get("/", async (c) => {
  const q = c.req.query();
  const parsed = v.safeParse(querySchema, {
    symbol: (q.symbol ?? "BTCUSDT").toUpperCase(),
    days: Number(q.days ?? 30),
    threshold: Number(q.threshold ?? 1),
    amount: Number(q.amount ?? 20),
    dailyCap: Number(q.dailyCap ?? 100),
    weeklyCap: Number(q.weeklyCap ?? 500),
    cooldown: Number(q.cooldown ?? 60),
  });
  if (!parsed.success) {
    return c.json({ error: "INVALID_BACKTEST_PARAMS" }, 400);
  }
  const p = parsed.output;

  try {
    const candles = await fetchHourlyCandles(p.symbol, p.days);
    if (candles.length < 25) {
      return c.json({ error: "NOT_ENOUGH_HISTORY" }, 400);
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

    const response: BacktestResponse = {
      ...result,
      // Don't ship hundreds of trades to the client; the last 20 tell the story.
      trades: result.trades.slice(-20),
      tradeCount: result.trades.length,
      symbol: p.symbol,
      days: p.days,
      config,
    };
    return c.json(response);
  } catch (error) {
    console.error("Backtest failed:", error);
    return c.json({ error: "BACKTEST_FAILED" }, 500);
  }
});
