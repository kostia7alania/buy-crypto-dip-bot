import { describe, expect, it } from 'vitest';
import { evaluateRisk } from './index.js';

describe('evaluateRisk', () => {
  it('rejects live trading by default', () => {
    const decision = evaluateRisk({ requestedMode: 'LIVE', liveTradingEnabled: false, symbol: 'BTCUSDT', allowlistSymbols: ['BTCUSDT'], quoteAmount: 5, spentToday: 0, spentThisWeek: 0, maxDailySpend: 20, maxWeeklySpend: 100 });
    expect(decision.status).toBe('REJECTED');
    expect(decision.reasons).toContain('LIVE_TRADING_DISABLED');
  });

  it('approves dry-run inside limits', () => {
    const decision = evaluateRisk({ requestedMode: 'DRY_RUN', liveTradingEnabled: false, symbol: 'BTCUSDT', allowlistSymbols: ['BTCUSDT'], quoteAmount: 5, spentToday: 0, spentThisWeek: 0, maxDailySpend: 20, maxWeeklySpend: 100 });
    expect(decision.status).toBe('APPROVED');
  });
});
