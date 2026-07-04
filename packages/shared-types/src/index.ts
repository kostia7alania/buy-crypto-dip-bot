export type TradingMode = 'DRY_RUN' | 'LIVE';
export type SignalType = 'BUY_SIGNAL' | 'NO_SIGNAL';
export type RiskStatus = 'APPROVED' | 'REJECTED';

export type Strategy = {
  id: string;
  name: string;
  symbol: 'BTCUSDT';
  mode: TradingMode;
  enabled: boolean;
};

export type Signal = {
  type: SignalType;
  symbol: string;
  reason: string;
  currentPrice: number;
  dropPercent: number;
  suggestedQuoteAmount: number;
  createdAt: string;
};

export type RiskDecision = {
  status: RiskStatus;
  reasons: string[];
  snapshot: Record<string, unknown>;
};

export type DryRunOrder = {
  id: string;
  signalId: string;
  symbol: string;
  side: 'BUY';
  quoteAmount: number;
  mode: 'DRY_RUN';
  createdAt: string;
};
