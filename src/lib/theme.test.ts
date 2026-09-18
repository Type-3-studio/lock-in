import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, isThemeMode, resolveTheme } from './theme.js';

describe('isThemeMode', () => {
  it('accepts the three valid modes', () => {
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isThemeMode('violet')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('returns explicit modes untouched', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the OS when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('defaults to system', () => {
    expect(DEFAULT_THEME).toBe('system');
  });
});
