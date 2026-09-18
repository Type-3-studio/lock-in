import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db.js';
import { createTask, listHistory, listOccurrencesForTask } from './store.js';
import { runMissedRollover } from './rollover.js';
import { addDays } from '../lib/date-util.js';
import { todayISO } from '../lib/clock.js';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('runMissedRollover', () => {
  it('rolls untracked past occurrences to missed and logs each', async () => {
    const anchor = addDays(todayISO(), -3);
    const task = await createTask({ title: 'stretch', anchorDate: anchor, recurrence: 'daily' });

    const count = await runMissedRollover();
    expect(count).toBe(3);

    const occurrences = await listOccurrencesForTask(task.id);
    expect(occurrences).toHaveLength(3);
    expect(occurrences.every((occurrence) => occurrence.status === 'missed')).toBe(true);

    const history = await listHistory();
    expect(history).toHaveLength(3);
    expect(history.every((entry) => entry.type === 'task_missed')).toBe(true);
  });

  it('is idempotent across runs', async () => {
    await createTask({
      title: 'stretch',
      anchorDate: addDays(todayISO(), -2),
      recurrence: 'daily',
    });
    expect(await runMissedRollover()).toBe(2);
    expect(await runMissedRollover()).toBe(0);
  });

  it('does nothing when there is nothing past due', async () => {
    await createTask({ title: 'future', anchorDate: todayISO(), recurrence: 'none' });
    expect(await runMissedRollover()).toBe(0);
  });

  it('rolls back occurrence state if history logging fails', async () => {
    const task = await createTask({
      title: 'stretch',
      anchorDate: addDays(todayISO(), -2),
      recurrence: 'daily',
    });

    const addSpy = vi
      .spyOn(db.history, 'add')
      .mockRejectedValueOnce(new Error('history write failed'));

    await expect(runMissedRollover()).rejects.toThrow('history write failed');
    addSpy.mockRestore();

    expect(await listOccurrencesForTask(task.id)).toHaveLength(0);
    expect(await listHistory()).toHaveLength(0);
  });
});
