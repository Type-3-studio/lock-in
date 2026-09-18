import { describe, expect, it } from 'vitest';
import { buildCalendarMarks, buildDeadlineLineSpans } from './marks.js';
import type { Goal, Task } from '../db/types.js';
import type { ISODate } from './date-util.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Ship v1',
    reasons: '',
    specifics: '',
    measure: '',
    deadline: '2026-09-20',
    status: 'locked',
    createdAt: '2026-09-01T00:00:00.000Z',
    lockedAt: '2026-09-01T00:00:00.000Z',
    color: null,
    icon: null,
    activeTaskId: null,
    archived: false,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Write docs',
    goalId: null,
    anchorDate: '2026-09-15',
    recurrence: 'none',
    recurrenceDays: null,
    recurrenceEnd: null,
    sourceNoteId: null,
    order: 0,
    durationMinutes: 30,
    createdAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildCalendarMarks', () => {
  it('includes deadline marks for goals', () => {
    const marks = buildCalendarMarks(
      [makeGoal()],
      [],
      [],
      { start: '2026-09-15', end: '2026-09-20' },
    );
    const deadlines = marks.filter((m) => m.kind === 'deadline');
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].date).toBe('2026-09-20');
  });

  it('includes task marks', () => {
    const marks = buildCalendarMarks(
      [],
      [makeTask()],
      [],
      { start: '2026-09-15', end: '2026-09-15' },
    );
    const tasks = marks.filter((m) => m.kind === 'task');
    expect(tasks).toHaveLength(1);
  });

  it('excludes deadlines outside range', () => {
    const marks = buildCalendarMarks(
      [makeGoal({ deadline: '2026-10-01' })],
      [],
      [],
      { start: '2026-09-15', end: '2026-09-20' },
    );
    expect(marks.filter((m) => m.kind === 'deadline')).toHaveLength(0);
  });
});

describe('buildDeadlineLineSpans', () => {
  it('returns empty set when showLine is false', () => {
    const spans = buildDeadlineLineSpans([makeGoal()], '2026-09-15', { start: '2026-09-15', end: '2026-09-20' }, false);
    expect(spans.size).toBe(0);
  });

  it('spans from today to deadline for locked goals', () => {
    const spans = buildDeadlineLineSpans(
      [makeGoal()],
      '2026-09-15',
      { start: '2026-09-15', end: '2026-09-20' },
      true,
    );
    // Sep 15..20 = 6 days
    expect(spans.size).toBe(6);
    expect(spans.has('2026-09-15' as ISODate)).toBe(true);
    expect(spans.has('2026-09-20' as ISODate)).toBe(true);
  });

  it('skips non-locked goals', () => {
    const spans = buildDeadlineLineSpans(
      [makeGoal({ status: 'draft' })],
      '2026-09-15',
      { start: '2026-09-15', end: '2026-09-20' },
      true,
    );
    expect(spans.size).toBe(0);
  });

  it('skips goals without deadline', () => {
    const spans = buildDeadlineLineSpans(
      [makeGoal({ deadline: null })],
      '2026-09-15',
      { start: '2026-09-15', end: '2026-09-20' },
      true,
    );
    expect(spans.size).toBe(0);
  });
});
