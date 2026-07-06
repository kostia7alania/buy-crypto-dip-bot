export type TradingMode = "DRY_RUN" | "LIVE";
export type OrderSide = "BUY" | "SELL";
export type RiskDecisionStatus = "APPROVED" | "REJECTED";
export interface StrategyConfig {
  id: string;
  name: string;
  symbol: string;
  mode: TradingMode;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
}
export interface Signal {
  id: string;
  strategyId: string;
  symbol: string;
  type: "BUY_SIGNAL" | "NO_SIGNAL";
  reason: string;
  price: number;
  dropPercent: number;
  suggestedQuoteAmount: number;
  createdAt: string;
}
export interface RiskDecision {
  status: RiskDecisionStatus;
  reasonCodes: string[];
  snapshot: Record<string, unknown>;
}
export interface DryRunOrder {
  id: string;
  signalId: string;
  symbol: string;
  side: OrderSide;
  quoteAmount: number;
  price: number;
  createdAt: string;
}
