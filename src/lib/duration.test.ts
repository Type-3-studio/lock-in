import { describe, expect, it } from 'vitest';
import { decreaseDuration, formatDuration, increaseDuration, MIN_DURATION } from './duration.js';

describe('increaseDuration', () => {
  it('adds 30 minutes', () => {
    expect(increaseDuration(30)).toBe(60);
    expect(increaseDuration(60)).toBe(90);
  });
});

describe('decreaseDuration', () => {
  it('subtracts 30 minutes', () => {
    expect(decreaseDuration(60)).toBe(30);
    expect(decreaseDuration(90)).toBe(60);
  });

  it('does not go below MIN_DURATION', () => {
    expect(decreaseDuration(30)).toBe(MIN_DURATION);
    expect(decreaseDuration(MIN_DURATION)).toBe(MIN_DURATION);
    expect(decreaseDuration(10)).toBe(MIN_DURATION);
  });
});

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(5)).toBe('5m');
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(45)).toBe('45m');
  });

  it('formats hours only', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(75)).toBe('1h 15m');
  });
});
