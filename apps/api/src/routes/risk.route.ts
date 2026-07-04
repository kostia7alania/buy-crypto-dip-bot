import { Hono } from 'hono';
import { evaluateRisk } from '@buy-crypto-dip-bot/risk-engine';

export const riskRoute = new Hono().get('/status', (c) => {
  const env = c.get('env');
  const decision = evaluateRisk({
    requestedMode: 'LIVE',
    liveTradingEnabled: env.liveTradingEnabled,
    symbol: 'BTCUSDT',
    allowlistSymbols: env.allowlistSymbols,
    quoteAmount: 5,
    spentToday: 0,
    spentThisWeek: 0,
    maxDailySpend: env.MAX_DAILY_SPEND_USDT,
    maxWeeklySpend: env.MAX_WEEKLY_SPEND_USDT,
  });

  return c.json({ defaultLiveTradeAttempt: decision });
});
