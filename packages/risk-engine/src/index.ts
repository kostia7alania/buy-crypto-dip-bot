import type { RiskDecision, TradingMode } from '@buy-crypto-dip-bot/shared-types';

export type RiskInput = {
  requestedMode: TradingMode;
  liveTradingEnabled: boolean;
  symbol: string;
  allowlistSymbols: string[];
  quoteAmount: number;
  spentToday: number;
  spentThisWeek: number;
  maxDailySpend: number;
  maxWeeklySpend: number;
};

export function evaluateRisk(input: RiskInput): RiskDecision {
  const reasons: string[] = [];

  if (input.requestedMode === 'LIVE' && !input.liveTradingEnabled) {
    reasons.push('LIVE_TRADING_DISABLED');
  }

  if (!input.allowlistSymbols.includes(input.symbol)) {
    reasons.push('SYMBOL_NOT_ALLOWED');
  }

  if (input.spentToday + input.quoteAmount > input.maxDailySpend) {
    reasons.push('DAILY_LIMIT_EXCEEDED');
  }

  if (input.spentThisWeek + input.quoteAmount > input.maxWeeklySpend) {
    reasons.push('WEEKLY_LIMIT_EXCEEDED');
  }

  return {
    status: reasons.length === 0 ? 'APPROVED' : 'REJECTED',
    reasons,
    snapshot: {
      requestedMode: input.requestedMode,
      liveTradingEnabled: input.liveTradingEnabled,
      symbol: input.symbol,
      quoteAmount: input.quoteAmount,
      spentToday: input.spentToday,
      spentThisWeek: input.spentThisWeek,
      maxDailySpend: input.maxDailySpend,
      maxWeeklySpend: input.maxWeeklySpend,
    },
  };
}
