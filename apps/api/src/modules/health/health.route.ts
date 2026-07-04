import { Hono } from 'hono';
export const healthRoutes = new Hono()
  .get('/', (c) => c.json({ ok: true, service: 'api' }))
  .get('/version', (c) => c.json({ name: 'buy-crypto-dip-bot', runtime: process.version }));
