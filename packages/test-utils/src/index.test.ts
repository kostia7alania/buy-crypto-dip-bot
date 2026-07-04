import { describe, expect, it } from 'vitest';
import { fixedNow } from './index.js';

describe('fixedNow', () => {
  it('returns stable date', () => {
    expect(fixedNow().toISOString()).toBe('2026-07-04T00:00:00.000Z');
  });
});
