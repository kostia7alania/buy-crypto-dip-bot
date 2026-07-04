import { describe, expect, it } from 'vitest';
import { evaluateDipStrategy } from './index.js';
const strategy = { id: 's1', name: 'BTC dip', symbol: 'BTCUSDT' as const, mode: 'DRY_RUN' as const, maxDailySpendUsdt: 20, maxWeeklySpendUsdt: 100, cooldownMinutes: 360 };
describe('evaluateDipStrategy', () => { it('creates buy signal when threshold is met', () => { const signal = evaluateDipStrategy({ strategy, currentPrice: 90, high24h: 100, thresholdPercent: 10, suggestedQuoteAmount: 20, now: '2026-01-01T00:00:00Z' }); expect(signal.type).toBe('BUY_SIGNAL'); }); });
