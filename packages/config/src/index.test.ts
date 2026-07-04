import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.js';

describe('defaultConfig', () => {
  it('defaults to dry-run', () => {
    expect(defaultConfig.defaultMode).toBe('DRY_RUN');
  });
});
