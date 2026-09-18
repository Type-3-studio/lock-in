import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  compareDates,
  dayOfWeek,
  daysInMonth,
  diffDays,
  eachDate,
  endOfMonth,
  endOfWeek,
  fromDayNumber,
  isoWeek,
  startOfMonth,
  startOfWeek,
  toDayNumber,
} from './date-util.js';

describe('daysInMonth', () => {
  it('handles leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe('toDayNumber / fromDayNumber', () => {
  it('anchors the unix epoch at day zero', () => {
    expect(toDayNumber('1970-01-01')).toBe(0);
    expect(fromDayNumber(0)).toBe('1970-01-01');
  });

  it('round-trips across a wide range', () => {
    for (const date of ['1969-12-31', '2000-02-29', '2026-09-15', '2100-01-01']) {
      expect(fromDayNumber(toDayNumber(date))).toBe(date);
    }
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('respects leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('is a no-op for zero', () => {
    expect(addDays('2026-09-15', 0)).toBe('2026-09-15');
  });
});

describe('diffDays / compareDates', () => {
  it('measures whole-day differences', () => {
    expect(diffDays('2026-09-20', '2026-09-15')).toBe(5);
    expect(diffDays('2026-09-15', '2026-09-20')).toBe(-5);
    expect(diffDays('2026-03-01', '2026-02-28')).toBe(1);
  });

  it('orders dates', () => {
    expect(compareDates('2026-09-15', '2026-09-16')).toBe(-1);
    expect(compareDates('2026-09-16', '2026-09-15')).toBe(1);
    expect(compareDates('2026-09-15', '2026-09-15')).toBe(0);
  });
});

describe('dayOfWeek / week boundaries', () => {
  it('uses ISO numbering (Mon=1..Sun=7)', () => {
    expect(dayOfWeek('2026-09-14')).toBe(1);
    expect(dayOfWeek('2026-09-15')).toBe(2);
    expect(dayOfWeek('2026-09-20')).toBe(7);
  });

  it('computes the Monday-Sunday span', () => {
    expect(startOfWeek('2026-09-15')).toBe('2026-09-14');
    expect(endOfWeek('2026-09-15')).toBe('2026-09-20');
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14');
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14');
  });
});

describe('isoWeek', () => {
  it('numbers ordinary weeks', () => {
    expect(isoWeek('2026-09-15')).toEqual({ year: 2026, week: 38 });
  });

  it('rolls early January into the previous ISO year', () => {
    expect(isoWeek('2021-01-01').year).toBe(2020);
    expect(isoWeek('2021-01-01').week).toBe(53);
    expect(isoWeek('2016-01-01').week).toBe(53);
  });

  it('rolls late December into the next ISO year', () => {
    expect(isoWeek('2025-12-29')).toEqual({ year: 2026, week: 1 });
    expect(isoWeek('2019-12-30')).toEqual({ year: 2020, week: 1 });
  });

  it('keeps week 1 boundaries consistent', () => {
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeek('2020-01-01')).toEqual({ year: 2020, week: 1 });
    expect(isoWeek('2020-12-31')).toEqual({ year: 2020, week: 53 });
  });
});

describe('startOfMonth / endOfMonth / addMonths', () => {
  it('finds month boundaries', () => {
    expect(startOfMonth('2026-09-15')).toBe('2026-09-01');
    expect(endOfMonth('2026-09-15')).toBe('2026-09-30');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(endOfMonth('2025-02-10')).toBe('2025-02-28');
  });

  it('adds months with day clamping', () => {
    expect(addMonths('2026-09-15', 1)).toBe('2026-10-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2028-03-31', -1)).toBe('2028-02-29');
  });
});

describe('eachDate', () => {
  it('is inclusive of both ends', () => {
    expect(eachDate('2026-09-14', '2026-09-20')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
  });

  it('returns a single date when start equals end', () => {
    expect(eachDate('2026-09-15', '2026-09-15')).toEqual(['2026-09-15']);
  });

  it('returns empty when start is after end', () => {
    expect(eachDate('2026-09-16', '2026-09-15')).toEqual([]);
  });
});
