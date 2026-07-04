import type { Signal } from '@buy-crypto-dip-bot/shared-types';

export type DipStrategyInput = {
  symbol: 'BTCUSDT';
  currentPrice: number;
  referenceHigh: number;
  thresholdPercent: number;
  quoteAmount: number;
  now?: Date;
};

export function evaluateDipStrategy(input: DipStrategyInput): Signal {
  const dropPercent = ((input.referenceHigh - input.currentPrice) / input.referenceHigh) * 100;
  const isBuy = dropPercent >= input.thresholdPercent;

  return {
    type: isBuy ? 'BUY_SIGNAL' : 'NO_SIGNAL',
    symbol: input.symbol,
    reason: isBuy ? 'DROP_THRESHOLD_REACHED' : 'DROP_BELOW_THRESHOLD',
    currentPrice: input.currentPrice,
    dropPercent,
    suggestedQuoteAmount: isBuy ? input.quoteAmount : 0,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}
