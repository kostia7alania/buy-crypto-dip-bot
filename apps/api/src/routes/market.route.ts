import { Hono } from 'hono';
import { createBybitPublicClient } from '@buy-crypto-dip-bot/exchange-bybit';

export const marketRoute = new Hono().get('/:symbol/ticker', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const env = c.get('env');

  if (!env.allowlistSymbols.includes(symbol)) {
    return c.json({ error: 'SYMBOL_NOT_ALLOWED', symbol }, 400);
  }

  const client = createBybitPublicClient();
  const ticker = await client.getTicker(symbol);
  return c.json(ticker);
});
