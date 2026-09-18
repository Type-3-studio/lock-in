import { describe, expect, it } from 'vitest';
import type { HistoryEntry, HistoryType } from '../db/types.js';
import { historyStats } from './stats.js';

function entry(
  type: HistoryType,
  snapshot: unknown,
  timestamp = '2026-09-15T12:00:00.000Z',
): HistoryEntry {
  return { id: `${type}-${timestamp}`, type, refId: 'r1', snapshot, timestamp };
}

describe('historyStats', () => {
  it('returns zeros for an empty log', () => {
    const stats = historyStats([]);
    expect(stats.completed).toBe(0);
    expect(stats.averageDaysToComplete).toBeNull();
    expect(stats.completedGoals).toEqual([]);
  });

  it('counts each event type', () => {
    const stats = historyStats([
      entry('goal_locked', {}),
      entry('goal_completed', {}),
      entry('goal_failed', {}),
      entry('goal_abandoned', {}),
      entry('task_done', {}),
      entry('task_done', {}),
      entry('task_missed', {}),
    ]);
    expect(stats).toMatchObject({
      locked: 1,
      completed: 1,
      failed: 1,
      abandoned: 1,
      tasksDone: 2,
      tasksMissed: 1,
    });
  });

  it('computes days from lock to completion', () => {
    const stats = historyStats([
      entry(
        'goal_completed',
        { title: 'Ship v1', lockedAt: '2026-09-01T00:00:00.000Z' },
        '2026-09-08T00:00:00.000Z',
      ),
      entry(
        'goal_completed',
        { title: 'Read book', lockedAt: '2026-09-01T00:00:00.000Z' },
        '2026-09-05T00:00:00.000Z',
      ),
    ]);
    expect(stats.completedGoals).toEqual([
      { title: 'Ship v1', days: 7 },
      { title: 'Read book', days: 4 },
    ]);
    expect(stats.averageDaysToComplete).toBe(5.5);
  });

  it('falls back to createdAt when lockedAt is missing, and skips undated entries', () => {
    const stats = historyStats([
      entry('goal_completed', { title: 'A', createdAt: '2026-09-10T00:00:00.000Z' }, '2026-09-12T00:00:00.000Z'),
      entry('goal_completed', { title: 'B' }, '2026-09-12T00:00:00.000Z'),
    ]);
    expect(stats.completedGoals).toEqual([{ title: 'A', days: 2 }]);
    expect(stats.averageDaysToComplete).toBe(2);
  });
});
