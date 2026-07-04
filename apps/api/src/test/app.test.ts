import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

const env = {
  API_PORT: 8787,
  API_HOST: '127.0.0.1',
  LIVE_TRADING_ENABLED: 'false' as const,
  ALLOWLIST_SYMBOLS: 'BTCUSDT',
  MAX_DAILY_SPEND_USDT: 20,
  MAX_WEEKLY_SPEND_USDT: 100,
  allowlistSymbols: ['BTCUSDT'],
  liveTradingEnabled: false,
};

describe('api app', () => {
  it('returns health', async () => {
    const app = createApiApp(env);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
