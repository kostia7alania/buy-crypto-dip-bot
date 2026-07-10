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
