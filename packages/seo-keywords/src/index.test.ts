import { describe, expect, it } from 'vitest';
import { seoRoutes } from './index.js';

describe('seoRoutes', () => {
  it('includes buy crypto dip bot route', () => {
    expect(seoRoutes).toContain('/buy-crypto-dip-bot');
  });
});
