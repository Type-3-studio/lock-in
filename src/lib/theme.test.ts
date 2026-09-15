import { describe, expect, it } from 'vitest';
import { ACCENTS, accentById, contrastFor, hexToRgb, shade, tint } from './theme.js';

describe('hexToRgb', () => {
  it('parses 6-digit hex with or without a hash', () => {
    expect(hexToRgb('#6b3fa0')).toEqual([107, 63, 160]);
    expect(hexToRgb('ffffff')).toEqual([255, 255, 255]);
  });

  it('rejects malformed input', () => {
    expect(hexToRgb('#abc')).toBeNull();
    expect(hexToRgb('nope')).toBeNull();
  });
});

describe('shade / tint', () => {
  it('returns valid hex darker/lighter than the source', () => {
    const base = hexToRgb('#808080') ?? [0, 0, 0];
    const darker = hexToRgb(shade('#808080')) ?? [255, 255, 255];
    const lighter = hexToRgb(tint('#808080')) ?? [0, 0, 0];
    expect(darker[0]).toBeLessThan(base[0]);
    expect(lighter[0]).toBeGreaterThan(base[0]);
  });
});

describe('contrastFor', () => {
  it('picks readable foregrounds', () => {
    expect(contrastFor('#111111')).toBe('#ffffff');
    expect(contrastFor('#f5f5f5')).toBe('#111111');
  });
});

describe('accentById', () => {
  it('finds a preset and falls back to the first', () => {
    expect(accentById('terminal').primary).toBe('#15803d');
    expect(accentById('missing')).toEqual(ACCENTS[0]);
  });
});
