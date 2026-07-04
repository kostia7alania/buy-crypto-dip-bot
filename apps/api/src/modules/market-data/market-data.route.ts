import { Hono } from 'hono';
import { createBybitPublicClient } from '@buy-crypto-dip-bot/exchange-bybit';
const allowedSymbols = new Set((process.env.ALLOWLIST_SYMBOLS ?? 'BTCUSDT').split(','));
export const marketDataRoutes = new Hono().get('/:symbol/ticker', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  if (!allowedSymbols.has(symbol)) return c.json({ error: 'SYMBOL_NOT_ALLOWED' }, 400);
  const client = createBybitPublicClient({ baseUrl: 'https://api.bybit.com' });
  return c.json(await client.getTicker(symbol));
});
