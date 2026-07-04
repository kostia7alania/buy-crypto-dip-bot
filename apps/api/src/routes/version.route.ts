import { Hono } from 'hono';

export const versionRoute = new Hono().get('/', (c) =>
  c.json({ name: 'buy-crypto-dip-bot', product: 'DCA Guard', version: '0.0.0' }),
);
