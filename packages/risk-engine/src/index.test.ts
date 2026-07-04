import { describe, expect, it } from 'vitest';
import { evaluateRisk } from './index.js';
const signal = { id: 'sig', strategyId: 's1', symbol: 'BTCUSDT', type: 'BUY_SIGNAL' as const, reason: 'ok', price: 100, dropPercent: 10, suggestedQuoteAmount: 20, createdAt: 'now' };
const strategy = { id: 's1', name: 'BTC dip', symbol: 'BTCUSDT' as const, mode: 'LIVE' as const, maxDailySpendUsdt: 20, maxWeeklySpendUsdt: 100, cooldownMinutes: 360 };
describe('evaluateRisk', () => { it('rejects live trading by default', () => { const decision = evaluateRisk(signal, strategy, { liveTradingEnabled: false, allowedSymbols: ['BTCUSDT'], dailySpentUsdt: 0, weeklySpentUsdt: 0 }); expect(decision.status).toBe('REJECTED'); expect(decision.reasonCodes).toContain('LIVE_TRADING_DISABLED'); }); });
