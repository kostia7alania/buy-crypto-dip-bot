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
