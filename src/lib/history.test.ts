import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db.js';
import type { Goal, Task } from '../db/types.js';
import { listHistory } from '../db/store.js';
import {
  goalSnapshot,
  logGoalLocked,
  logGoalTerminal,
  logTaskMarked,
  snapshot,
  taskSnapshot,
} from './history.js';

const goal: Goal = {
  id: 'g1',
  title: 'Ship v1',
  reasons: 'prove I can finish what I start',
  specifics: 'a working PWA',
  measure: 'installed and used daily',
  deadline: '2026-10-01',
  status: 'draft',
  createdAt: '2026-09-15T00:00:00.000Z',
  lockedAt: null,
  color: '#f59e0b',
  icon: 'flag',
  activeTaskId: null,
  archived: false,
};

const task: Task = {
  id: 't1',
  title: 'write docs',
  goalId: 'g1',
  anchorDate: '2026-09-15',
  recurrence: 'weekly',
  recurrenceDays: null,
  recurrenceEnd: null,
  sourceNoteId: null,
  order: 0,
  createdAt: '2026-09-15T00:00:00.000Z',
  durationMinutes: 30,
};

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('snapshot', () => {
  it('deep-freezes a clone', () => {
    const source = { a: 1, nested: { b: [1, 2] } };
    const result = snapshot(source);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nested)).toBe(true);
    expect(Object.isFrozen(result.nested.b)).toBe(true);
    expect(result).not.toBe(source);
    expect(result.nested).not.toBe(source.nested);
  });

  it('is unaffected by later mutation of the source', () => {
    const source = { title: 'before', tags: ['a'] };
    const result = snapshot(source);
    source.title = 'after';
    source.tags.push('b');
    expect(result).toEqual({ title: 'before', tags: ['a'] });
  });
});

describe('snapshot builders', () => {
  it('copies goal fields without the id', () => {
    const result = goalSnapshot(goal);
    expect(result).toEqual({
      title: 'Ship v1',
      reasons: 'prove I can finish what I start',
      specifics: 'a working PWA',
      measure: 'installed and used daily',
      deadline: '2026-10-01',
      status: 'draft',
      createdAt: '2026-09-15T00:00:00.000Z',
      lockedAt: null,
      color: '#f59e0b',
      icon: 'flag',
      archived: false,
    });
    expect('id' in result).toBe(false);
  });

  it('captures a task occurrence with its date and status', () => {
    expect(taskSnapshot(task, '2026-09-22', 'done')).toMatchObject({
      title: 'write docs',
      goalId: 'g1',
      recurrence: 'weekly',
      date: '2026-09-22',
      status: 'done',
    });
  });
});

describe('loggers (append-only)', () => {
  it('logs a lock with a frozen snapshot', async () => {
    const written = await logGoalLocked(goal);
    expect(written.type).toBe('goal_locked');
    expect(written.refId).toBe('g1');
    expect(Object.isFrozen(written.snapshot)).toBe(true);

    const [entry] = await listHistory();
    expect(entry.snapshot).toMatchObject({ title: 'Ship v1', status: 'draft' });
  });

  it('maps each terminal status to its history type', async () => {
    await logGoalTerminal(goal, 'completed');
    await logGoalTerminal(goal, 'failed');
    await logGoalTerminal(goal, 'abandoned');
    const types = (await listHistory()).map((entry) => entry.type).sort();
    expect(types).toEqual(['goal_abandoned', 'goal_completed', 'goal_failed']);
  });

  it('captures self-rating and reflection in the terminal snapshot', async () => {
    const written = await logGoalTerminal(goal, 'completed', {
      rating: 'good',
      reflection: 'shipping beats perfect',
    });
    expect(written.snapshot).toMatchObject({
      outcome: { rating: 'good', reflection: 'shipping beats perfect' },
    });
    const [entry] = await listHistory();
    expect(entry.snapshot).toMatchObject({
      title: 'Ship v1',
      outcome: { rating: 'good', reflection: 'shipping beats perfect' },
    });
  });

  it('maps task done / missed entries', async () => {
    await logTaskMarked(task, '2026-09-15', 'done');
    await logTaskMarked(task, '2026-09-16', 'missed');
    const entries = await listHistory();
    expect(entries.map((entry) => entry.type).sort()).toEqual(['task_done', 'task_missed']);
    expect(entries.every((entry) => entry.refId === 't1')).toBe(true);
    expect(entries.find((entry) => entry.type === 'task_missed')?.snapshot).toMatchObject({
      date: '2026-09-16',
      status: 'missed',
    });
  });
});
