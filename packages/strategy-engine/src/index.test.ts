import { describe, expect, it } from 'vitest';
import { evaluateDipStrategy } from './index.js';

describe('evaluateDipStrategy', () => {
  it('returns no signal below threshold', () => {
    const signal = evaluateDipStrategy({ symbol: 'BTCUSDT', currentPrice: 95, referenceHigh: 100, thresholdPercent: 10, quoteAmount: 20, now: new Date('2026-07-04T00:00:00Z') });
    expect(signal.type).toBe('NO_SIGNAL');
    expect(signal.suggestedQuoteAmount).toBe(0);
  });

  it('returns buy signal at threshold', () => {
    const signal = evaluateDipStrategy({ symbol: 'BTCUSDT', currentPrice: 90, referenceHigh: 100, thresholdPercent: 10, quoteAmount: 20, now: new Date('2026-07-04T00:00:00Z') });
    expect(signal.type).toBe('BUY_SIGNAL');
    expect(signal.suggestedQuoteAmount).toBe(20);
  });
});
