import { Hono } from 'hono';
import { createDefaultRiskGuard } from '@buy-crypto-dip-bot/risk-engine';
export const riskRoutes = new Hono().get('/status', (c) => c.json(createDefaultRiskGuard().getStatus()));
