import type { Signal, StrategyConfig } from "@buy-crypto-dip-bot/shared-types";

export interface DipInput {
  strategy: StrategyConfig;
  currentPrice: number;
  high24h: number;
  thresholdPercent: number;
  suggestedQuoteAmount: number;
  now: string;
}

// --- Benchmark comparison -------------------------------------------------
// Compares the actual dip-buying result against two naive baselines deployed
// with the SAME total capital over the SAME window: dumb calendar DCA (equal
// daily buys) and buy-and-hold (all at the window's start price). This is the
// "does buying the dip actually beat doing nothing clever?" number.

export interface BenchmarkLeg {
  qty: number;
  valueUsdt: number;
  pnlPercent: number;
}

export interface BenchmarkInput {
  spentUsdt: number;
  actualQty: number;
  currentPrice: number;
  // Chronological daily closes covering the strategy's active window.
  closes: number[];
}

export interface BenchmarkResult {
  actual: BenchmarkLeg;
  calendarDca: BenchmarkLeg;
  hold: BenchmarkLeg;
}

const leg = (
  qty: number,
  spentUsdt: number,
  currentPrice: number,
): BenchmarkLeg => {
  const valueUsdt = qty * currentPrice;
  return {
    qty,
    valueUsdt,
    pnlPercent: spentUsdt > 0 ? ((valueUsdt - spentUsdt) / spentUsdt) * 100 : 0,
  };
};

export const compareToBenchmarks = (
  input: BenchmarkInput,
): BenchmarkResult | null => {
  const closes = input.closes.filter((c) => c > 0);
  if (input.currentPrice <= 0 || input.spentUsdt <= 0 || closes.length === 0) {
    return null;
  }

  // Calendar DCA: spread the same budget evenly across each daily close.
  const perDay = input.spentUsdt / closes.length;
  const calendarQty = closes.reduce((sum, close) => sum + perDay / close, 0);

  // Buy-and-hold: deploy everything at the window's opening price.
  const holdQty = input.spentUsdt / closes[0]!;

  return {
    actual: leg(input.actualQty, input.spentUsdt, input.currentPrice),
    calendarDca: leg(calendarQty, input.spentUsdt, input.currentPrice),
    hold: leg(holdQty, input.spentUsdt, input.currentPrice),
  };
};

export const evaluateDipStrategy = (input: DipInput): Signal => {
  if (input.currentPrice <= 0) {
    throw new Error("CURRENT_PRICE_MUST_BE_POSITIVE");
  }

  if (input.high24h <= 0) {
    throw new Error("HIGH_24H_MUST_BE_POSITIVE");
  }

  const dropPercent =
    ((input.high24h - input.currentPrice) / input.high24h) * 100;
  const isBuy = dropPercent >= input.thresholdPercent;

  return {
    id: `signal-${input.now}`,
    strategyId: input.strategy.id,
    symbol: input.strategy.symbol,
    type: isBuy ? "BUY_SIGNAL" : "NO_SIGNAL",
    reason: isBuy
      ? "DROP_FROM_24H_HIGH_THRESHOLD_MET"
      : "DROP_FROM_24H_HIGH_THRESHOLD_NOT_MET",
    price: input.currentPrice,
    dropPercent,
    suggestedQuoteAmount: isBuy ? input.suggestedQuoteAmount : 0,
    createdAt: input.now,
  };
};

/* ------------------------------------------------------------------ */
/* Backtest: replay the dip strategy over historical candles           */
/* ------------------------------------------------------------------ */

// Structural twin of exchange-core's Candle — this package stays free of
// exchange dependencies.
export interface BacktestCandle {
  openTime: number; // ms epoch
  high: number;
  close: number;
}

export interface BacktestConfig {
  thresholdPercent: number;
  buyAmountUsdt: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
}

export interface BacktestTrade {
  time: number; // ms epoch
  price: number;
  spentUsdt: number;
  dropPercent: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  spentUsdt: number;
  qty: number;
  finalPrice: number;
  valueUsdt: number;
  pnlUsdt: number;
  pnlPercent: number;
  benchmarks: BenchmarkResult | null;
  candles: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

// Replays the exact production rules — drop from rolling 24h high,
// cooldown, rolling daily/weekly spend caps — over chronological hourly
// candles. Pure function: same inputs, same story.
export const runDipBacktest = (
  candles: BacktestCandle[],
  config: BacktestConfig,
): BacktestResult | null => {
  // Need a day of history to compute the first rolling 24h high.
  if (candles.length < 25) return null;

  const trades: BacktestTrade[] = [];
  let spentUsdt = 0;
  let qty = 0;
  let lastBuyTime = -Infinity;
  const cooldownMs = config.cooldownMinutes * 60 * 1000;

  const spentSince = (cutoff: number) =>
    trades.reduce((s, t) => (t.time >= cutoff ? s + t.spentUsdt : s), 0);

  for (let i = 24; i < candles.length; i++) {
    const candle = candles[i]!;
    if (candle.close <= 0) continue;

    let high24 = 0;
    for (let j = i - 24; j < i; j++) {
      const h = candles[j]!.high;
      if (h > high24) high24 = h;
    }
    if (high24 <= 0) continue;

    const dropPercent = ((high24 - candle.close) / high24) * 100;
    if (dropPercent < config.thresholdPercent) continue;
    if (candle.openTime - lastBuyTime < cooldownMs) continue;
    if (
      spentSince(candle.openTime - DAY_MS) + config.buyAmountUsdt >
      config.maxDailySpendUsdt
    )
      continue;
    if (
      spentSince(candle.openTime - WEEK_MS) + config.buyAmountUsdt >
      config.maxWeeklySpendUsdt
    )
      continue;

    trades.push({
      time: candle.openTime,
      price: candle.close,
      spentUsdt: config.buyAmountUsdt,
      dropPercent,
    });
    spentUsdt += config.buyAmountUsdt;
    qty += config.buyAmountUsdt / candle.close;
    lastBuyTime = candle.openTime;
  }

  const finalPrice = candles[candles.length - 1]!.close;
  const valueUsdt = qty * finalPrice;

  // Daily closes for the benchmark legs (every 24th candle).
  const dailyCloses: number[] = [];
  for (let i = 24; i < candles.length; i += 24) {
    dailyCloses.push(candles[i]!.close);
  }

  return {
    trades,
    spentUsdt,
    qty,
    finalPrice,
    valueUsdt,
    pnlUsdt: valueUsdt - spentUsdt,
    pnlPercent: spentUsdt > 0 ? ((valueUsdt - spentUsdt) / spentUsdt) * 100 : 0,
    benchmarks:
      spentUsdt > 0
        ? compareToBenchmarks({
            spentUsdt,
            actualQty: qty,
            currentPrice: finalPrice,
            closes: dailyCloses,
          })
        : null,
    candles: candles.length,
  };
};
