import { Hono } from 'hono';
import type { ApiEnv } from './env.js';
import { healthRoute } from './routes/health.route.js';
import { marketRoute } from './routes/market.route.js';
import { riskRoute } from './routes/risk.route.js';
import { versionRoute } from './routes/version.route.js';

export function createApiApp(env: ApiEnv) {
  const app = new Hono<{ Variables: { env: ApiEnv } }>();

  app.use('*', async (c, next) => {
    c.set('env', env);
    await next();
  });

  app.route('/health', healthRoute);
  app.route('/version', versionRoute);
  app.route('/market', marketRoute);
  app.route('/risk', riskRoute);

  return app;
}
