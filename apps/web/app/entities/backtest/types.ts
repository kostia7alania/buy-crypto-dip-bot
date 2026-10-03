export interface BacktestTrade {
  time: number;
  price: number;
  spentUsdt: number;
  dropPercent: number;
}

export interface BacktestLeg {
  qty: number;
  valueUsdt: number;
  pnlPercent: number;
}

export interface BacktestHistory {
  status: "COMPLETE" | "INCOMPLETE";
  issues: (
    | "SHORT_HISTORY"
    | "MISSING_HOURS"
    | "INVALID_CANDLES"
    | "IRREGULAR_TIMESTAMPS"
    | "UNCONFIRMED_CLOSE"
    | "STALE_HISTORY"
    | "UNKNOWN_SOURCE_TIME"
  )[];
  expectedCandles: number;
  receivedCandles: number;
  warmupCandles: number;
  replayCandles: number;
  inputStartAt: number | null;
  inputEndAt: number | null;
  replayStartAt: number | null;
  replayEndAt: number | null;
  missingHours: number;
  unconfirmedCandles: number;
}

export interface BacktestReport {
  symbol: string;
  days: number;
  tradeCount: number;
  trades: BacktestTrade[];
  spentUsdt: number;
  qty: number;
  finalPrice: number;
  valueUsdt: number;
  pnlUsdt: number;
  pnlPercent: number;
  history: BacktestHistory;
  provenance: {
    source: "BYBIT_SPOT";
    interval: "60";
    pages: { sourceAt: string; receivedAt: string }[];
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
  benchmarks: {
    actual: BacktestLeg;
    calendarDca: BacktestLeg;
    hold: BacktestLeg;
  } | null;
  config: {
    thresholdPercent: number;
    buyAmountUsdt: number;
    maxDailySpendUsdt: number;
    maxWeeklySpendUsdt: number;
    cooldownMinutes: number;
  };
}

export interface BacktestParams {
  symbol: string;
  days: number;
  threshold: number;
  amount: number;
}
