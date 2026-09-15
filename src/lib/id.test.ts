import { describe, it, expect } from 'vitest';
import { newId } from './id.js';

describe('newId', () => {
  it('returns a non-empty string', () => {
    expect(newId().length).toBeGreaterThan(0);
  });

  it('returns unique values', () => {
    expect(newId()).not.toBe(newId());
  });
});
