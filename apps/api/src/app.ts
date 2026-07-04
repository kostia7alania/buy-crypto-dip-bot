import { Hono } from 'hono';
import { healthRoutes } from './modules/health/health.route.js';
import { marketDataRoutes } from './modules/market-data/market-data.route.js';
import { riskRoutes } from './modules/risk/risk.route.js';

export const createApp = () => {
  const app = new Hono();
  app.route('/health', healthRoutes);
  app.route('/market', marketDataRoutes);
  app.route('/risk', riskRoutes);
  return app;
};
