import { describe, expect, it } from 'vitest';
import type { Occurrence, Task, TaskStatus } from '../db/types.js';
import { goalProgress } from './progress.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    goalId: 'g1',
    anchorDate: '2026-09-14',
    recurrence: 'daily',
    recurrenceDays: null,
    recurrenceEnd: null,
    sourceNoteId: null,
    order: 0,
    createdAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function occurrence(taskId: string, date: string, status: TaskStatus): Occurrence {
  return { id: `${taskId}@${date}`, taskId, date, status };
}

const range = { start: '2026-09-14', end: '2026-09-16' };

describe('goalProgress', () => {
  it('reports an empty rollup when there are no tasks', () => {
    expect(goalProgress([], [], range, null)).toEqual({ done: 0, total: 0, ratio: null });
  });

  it('counts done out of generated occurrences', () => {
    const task = makeTask();
    const occurrences = [
      occurrence('t1', '2026-09-14', 'done'),
      occurrence('t1', '2026-09-15', 'done'),
      occurrence('t1', '2026-09-16', 'pending'),
    ];
    expect(goalProgress([task], occurrences, range, null)).toEqual({
      done: 2,
      total: 3,
      ratio: 2 / 3,
    });
  });

  it('counts missed and pending in the total but not as done', () => {
    const task = makeTask();
    const occurrences = [
      occurrence('t1', '2026-09-14', 'missed'),
      occurrence('t1', '2026-09-15', 'pending'),
      occurrence('t1', '2026-09-16', 'done'),
    ];
    expect(goalProgress([task], occurrences, range, null)).toEqual({
      done: 1,
      total: 3,
      ratio: 1 / 3,
    });
  });

  it('clips occurrences at the goal deadline', () => {
    const task = makeTask();
    const occurrences = [
      occurrence('t1', '2026-09-14', 'done'),
      occurrence('t1', '2026-09-15', 'done'),
      occurrence('t1', '2026-09-16', 'pending'),
    ];
    expect(goalProgress([task], occurrences, range, '2026-09-15')).toEqual({
      done: 2,
      total: 2,
      ratio: 1,
    });
  });

  it('sums across multiple tasks and ignores unknown records', () => {
    const a = makeTask({ id: 'a' });
    const b = makeTask({ id: 'b', recurrence: 'none', anchorDate: '2026-09-16' });
    const occurrences = [
      occurrence('a', '2026-09-14', 'done'),
      occurrence('b', '2026-09-16', 'done'),
      occurrence('ghost', '2026-09-14', 'done'),
    ];
    expect(goalProgress([a, b], occurrences, range, null)).toEqual({
      done: 2,
      total: 4,
      ratio: 0.5,
    });
  });
});
