import { describe, expect, it } from 'vitest';
import { QUOTES, quoteFor } from './quotes.js';

describe('quoteFor', () => {
  it('returns a quote from the collection', () => {
    expect(QUOTES).toContain(quoteFor('goal-1'));
  });

  it('is deterministic for a seed', () => {
    expect(quoteFor('goal-1')).toEqual(quoteFor('goal-1'));
  });

  it('spreads seeds across multiple quotes', () => {
    const quotes = new Set(Array.from({ length: 50 }, (_, index) => quoteFor(`seed-${index}`)));
    expect(quotes.size).toBeGreaterThan(1);
  });
});
