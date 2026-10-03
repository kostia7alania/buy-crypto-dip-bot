export type ReportStatus = "EMPTY" | "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type ReportIssue =
  | "MARKET_UNAVAILABLE"
  | "STALE_MARKET"
  | "INCOMPLETE_HISTORY";

export interface ReportMarketSource {
  source: "BYBIT_SPOT_TICKER_V5" | "BYBIT_SPOT_KLINE_V5";
  sourceAt: string;
  receivedAt: string;
  ttlMs: number;
}

export const reportAssumptions = {
  mode: "DRY_RUN",
  fees: "NOT_MODELLED",
  slippage: "NOT_MODELLED",
} as const;

export interface ReportMetadata {
  status: ReportStatus;
  // Final assembly cutoff used to validate every included market source.
  generatedAt: string;
  assumptions: typeof reportAssumptions;
}

export interface PnlPosition {
  symbol: string;
  orders: number;
  spentUsdt: number;
  baseQty: number;
  avgBuyPrice: number;
  currentPrice: number | null;
  currentValueUsdt: number | null;
  pnlUsdt: number | null;
  pnlPercent: number | null;
  issue: ReportIssue | null;
  quote: ReportMarketSource | null;
}

export interface PnlTotals {
  spentUsdt: number;
  currentValueUsdt: number | null;
  pnlUsdt: number | null;
  pnlPercent: number | null;
}

export interface PnlReport extends ReportMetadata {
  positions: PnlPosition[];
  totals: PnlTotals;
}

export interface BenchmarkLeg {
  qty: number;
  valueUsdt: number;
  pnlPercent: number;
}

export interface PerformancePosition {
  symbol: string;
  orders: number;
  spentUsdt: number;
  currentPrice: number | null;
  actual: BenchmarkLeg | null;
  calendarDca: BenchmarkLeg | null;
  hold: BenchmarkLeg | null;
  issue: ReportIssue | null;
  quote: ReportMarketSource | null;
  history: ReportMarketSource | null;
  window: {
    requestedFrom: string;
    from: string | null;
    through: string | null;
    candles: number;
  };
}

export interface PerformanceReport extends ReportMetadata {
  method: "DAILY_CLOSE_EQUAL_CAPITAL_V1";
  positions: PerformancePosition[];
}
