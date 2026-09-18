import { describe, expect, it } from 'vitest';
import type { Goal, Occurrence, Task, TaskStatus } from '../db/types.js';
import { planMissedRollover } from './rollover.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Goal',
    reasons: '',
    specifics: '',
    measure: '',
    deadline: null,
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
    title: 'Task',
    goalId: null,
    anchorDate: '2026-09-14',
    recurrence: 'none',
    recurrenceDays: null,
    recurrenceEnd: null,
    sourceNoteId: null,
    order: 0,
    createdAt: '2026-09-14T00:00:00.000Z',
    durationMinutes: 30,
    ...overrides,
  };
}

function occurrence(taskId: string, date: string, status: TaskStatus): Occurrence {
  return { id: `${taskId}@${date}`, taskId, date, status };
}

describe('planMissedRollover', () => {
  it('flags an untracked past occurrence as missed', () => {
    const changes = planMissedRollover([makeTask()], [], [], '2026-09-20');
    expect(changes.map((change) => change.date)).toEqual(['2026-09-14']);
  });

  it('leaves done occurrences alone', () => {
    const changes = planMissedRollover(
      [makeTask()],
      [occurrence('t1', '2026-09-14', 'done')],
      [],
      '2026-09-20',
    );
    expect(changes).toEqual([]);
  });

  it('is idempotent — already-missed occurrences are not re-flagged', () => {
    const changes = planMissedRollover(
      [makeTask()],
      [occurrence('t1', '2026-09-14', 'missed')],
      [],
      '2026-09-20',
    );
    expect(changes).toEqual([]);
  });

  it('never rolls over today or future days', () => {
    const changes = planMissedRollover([makeTask()], [], [], '2026-09-14');
    expect(changes).toEqual([]);
  });

  it('respects a goal deadline', () => {
    const goal = makeGoal({ deadline: '2026-09-15' });
    const task = makeTask({ goalId: 'g1', recurrence: 'daily' });
    const changes = planMissedRollover([task], [], [goal], '2026-09-20');
    expect(changes.map((change) => change.date)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('skips records before the lookback window', () => {
    const task = makeTask({ anchorDate: '2020-01-01', recurrence: 'daily' });
    const changes = planMissedRollover([task], [], [], '2026-09-20');
    expect(changes.length).toBe(366);
  });
});
