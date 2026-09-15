import { describe, it, expect } from 'vitest';
import type { Task } from '../db/types.js';
import { clipAtDeadline, generateOccurrences, occurrencesForTask } from './recurrence.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    goalId: null,
    anchorDate: '2026-09-14',
    recurrence: 'none',
    recurrenceDays: null,
    recurrenceEnd: null,
    sourceNoteId: null,
    order: 0,
    createdAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

const week = { start: '2026-09-14', end: '2026-09-20' };

describe('generateOccurrences', () => {
  it('returns an empty list when the range is reversed', () => {
    expect(generateOccurrences(makeTask(), { start: '2026-09-20', end: '2026-09-14' })).toEqual([]);
  });

  describe('none', () => {
    it('yields the anchor date only when it falls in range', () => {
      expect(generateOccurrences(makeTask(), week)).toEqual(['2026-09-14']);
      expect(generateOccurrences(makeTask({ anchorDate: '2026-09-16' }), week)).toEqual([
        '2026-09-16',
      ]);
    });

    it('yields nothing when the anchor is outside the range', () => {
      expect(generateOccurrences(makeTask({ anchorDate: '2026-09-21' }), week)).toEqual([]);
      expect(generateOccurrences(makeTask({ anchorDate: '2026-09-13' }), week)).toEqual([]);
    });
  });

  describe('daily', () => {
    it('fills every day in the range, never before the anchor', () => {
      const task = makeTask({ recurrence: 'daily', anchorDate: '2026-09-16' });
      expect(generateOccurrences(task, week)).toEqual([
        '2026-09-16',
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
      ]);
    });

    it('stops at an inclusive recurrenceEnd', () => {
      const task = makeTask({ recurrence: 'daily', recurrenceEnd: '2026-09-17' });
      expect(generateOccurrences(task, week)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']);
    });
  });

  describe('weekly', () => {
    it('repeats on the anchor weekday', () => {
      const task = makeTask({ recurrence: 'weekly', anchorDate: '2026-09-14' });
      const range = { start: '2026-09-14', end: '2026-10-05' };
      expect(generateOccurrences(task, range)).toEqual([
        '2026-09-14',
        '2026-09-21',
        '2026-09-28',
        '2026-10-05',
      ]);
    });

    it('skips earlier periods that precede the anchor', () => {
      const task = makeTask({ recurrence: 'weekly', anchorDate: '2026-09-16' });
      expect(generateOccurrences(task, week)).toEqual(['2026-09-16']);
    });
  });

  describe('custom', () => {
    it('only yields the selected ISO weekdays', () => {
      const task = makeTask({ recurrence: 'custom', recurrenceDays: [1, 3, 5] });
      expect(generateOccurrences(task, week)).toEqual([
        '2026-09-14',
        '2026-09-16',
        '2026-09-18',
      ]);
    });

    it('yields nothing when no weekdays are selected', () => {
      expect(generateOccurrences(makeTask({ recurrence: 'custom' }), week)).toEqual([]);
    });
  });
});

describe('clipAtDeadline', () => {
  it('is a no-op for a null deadline', () => {
    const dates = ['2026-09-14', '2026-09-20'];
    expect(clipAtDeadline(dates, null)).toEqual(dates);
  });

  it('keeps dates on or before the deadline (inclusive)', () => {
    const dates = ['2026-09-14', '2026-09-15', '2026-09-16'];
    expect(clipAtDeadline(dates, '2026-09-15')).toEqual(['2026-09-14', '2026-09-15']);
  });
});

describe('occurrencesForTask', () => {
  it('generates then clips at the goal deadline', () => {
    const task = makeTask({ recurrence: 'daily' });
    expect(occurrencesForTask(task, week, '2026-09-16')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
    ]);
  });

  it('ignores the deadline when none is set', () => {
    const task = makeTask({ recurrence: 'daily' });
    expect(occurrencesForTask(task, { start: '2026-09-14', end: '2026-09-15' }, null)).toEqual([
      '2026-09-14',
      '2026-09-15',
    ]);
  });
});
