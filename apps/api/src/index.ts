import { serve } from '@hono/node-server';
import { createApiApp } from './app.js';
import { readApiEnv } from './env.js';

const env = readApiEnv(process.env);
const app = createApiApp(env);

serve({ fetch: app.fetch, port: env.API_PORT, hostname: env.API_HOST }, (info) => {
  console.log(`api listening on http://${info.address}:${info.port}`);
});
