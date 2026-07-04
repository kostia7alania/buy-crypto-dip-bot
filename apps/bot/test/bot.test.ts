import { describe, expect, it } from 'vitest';
import { createBot } from '../src/bot.js';

describe('bot', () => {
  it('can be created', () => {
    expect(createBot('test-token')).toBeTruthy();
  });
});
