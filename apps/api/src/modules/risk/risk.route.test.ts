import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
describe('risk routes', () => {
  it('returns dry-run safety status', async () => {
    const res = await createApp().request('/risk/status');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ liveTradingEnabled: false });
  });
});
