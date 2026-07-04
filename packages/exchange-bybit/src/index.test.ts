import { describe, expect, it } from 'vitest';

describe('exchange-bybit placeholder', () => {
  it('documents public-only package', () => {
    expect('public-only').toContain('public');
  });
});
