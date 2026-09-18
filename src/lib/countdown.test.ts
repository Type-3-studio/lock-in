import { describe, expect, it } from 'vitest';
import { countdownTo, deadlineInstant, pad2 } from './countdown.js';

describe('deadlineInstant', () => {
  it('points at the next day start so the deadline day counts in full', () => {
    const target = deadlineInstant('2026-01-04');
    expect(target).toBe(new Date(2026, 0, 5, 0, 0, 0, 0).getTime());
  });
});

describe('countdownTo', () => {
  it('splits the remaining time into day/hour/minute/second', () => {
    const now = new Date(2026, 0, 1, 12, 0, 0).getTime();
    expect(countdownTo('2026-01-04', now)).toEqual({
      days: 3,
      hours: 12,
      minutes: 0,
      seconds: 0,
      overdue: false,
    });
  });

  it('rolls seconds and minutes correctly', () => {
    const now = new Date(2026, 0, 1, 0, 0, 0).getTime();
    const end = new Date(2026, 0, 5, 0, 0, 0).getTime();
    expect(countdownTo('2026-01-04', end - 65_000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 5,
      overdue: false,
    });
    expect(now).toBeLessThan(end);
  });

  it('clamps to zero and flags overdue once the day has passed', () => {
    const now = new Date(2026, 0, 5, 12, 0, 0).getTime();
    expect(countdownTo('2026-01-04', now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      overdue: true,
    });
  });
});

describe('pad2', () => {
  it('zero-pads single digits and leaves longer values alone', () => {
    expect(pad2(3)).toBe('03');
    expect(pad2(42)).toBe('42');
    expect(pad2(365)).toBe('365');
  });
});
