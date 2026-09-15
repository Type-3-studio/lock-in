import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db.js';
import {
  addNoteItem,
  createGoal,
  createNote,
  createTask,
  deleteGoal,
  deleteOccurrence,
  deleteTask,
  exportData,
  getGoal,
  importData,
  listBackups,
  listGoals,
  listHistory,
  listNotes,
  listOccurrencesForTask,
  listOccurrencesInRange,
  listTasks,
  liveGoals,
  logHistory,
  moveNoteItem,
  promoteNoteItem,
  removeNoteItem,
  restoreBackup,
  setNoteItemChecked,
  setGoalActiveTask,
  setOccurrenceStatus,
  updateGoal,
  updateNoteItem,
} from './store.js';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('goals', () => {
  it('creates a draft goal with sane defaults', async () => {
    const goal = await createGoal({ title: 'Ship v1' });
    expect(goal.id).toBeTruthy();
    expect(goal.status).toBe('draft');
    expect(goal.lockedAt).toBeNull();
    expect(goal.deadline).toBeNull();
    expect(goal.createdAt).toBeTruthy();
    expect(await getGoal(goal.id)).toEqual(goal);
  });

  it('updates and deletes', async () => {
    const goal = await createGoal({ title: 'Ship v1' });
    await updateGoal(goal.id, { status: 'locked', lockedAt: '2026-09-15T00:00:00.000Z' });
    expect((await getGoal(goal.id))?.status).toBe('locked');
    await deleteGoal(goal.id);
    expect(await getGoal(goal.id)).toBeUndefined();
  });

  it('lists newest first', async () => {
    await createGoal({ title: 'first' });
    await createGoal({ title: 'second' });
    const goals = await listGoals();
    expect(goals.map((goal) => goal.title)).toEqual(['second', 'first']);
  });

  it('notifies live queries', async () => {
    const seen: number[] = [];
    const subscription = liveGoals().subscribe((goals) => seen.push(goals.length));
    await vi.waitFor(() => expect(seen).toContain(0));
    await createGoal({ title: 'Ship v1' });
    await vi.waitFor(() => expect(seen).toContain(1));
    subscription.unsubscribe();
  });
});

describe('tasks', () => {
  it('creates a one-off task by default and filters by goal', async () => {
    const goal = await createGoal({ title: 'Ship v1' });
    const loose = await createTask({ title: 'buy milk', anchorDate: '2026-09-15' });
    await createTask({ title: 'write docs', anchorDate: '2026-09-15', goalId: goal.id });

    expect(loose.goalId).toBeNull();
    expect(loose.recurrence).toBe('none');
    expect(await listTasks()).toHaveLength(2);
    const tied = await listTasks(goal.id);
    expect(tied.map((task) => task.title)).toEqual(['write docs']);
  });

  it('orders tasks within a goal and tracks the focus pointer', async () => {
    const goal = await createGoal({ title: 'Ship v1' });
    const a = await createTask({ title: 'a', anchorDate: '2026-09-15', goalId: goal.id });
    const b = await createTask({ title: 'b', anchorDate: '2026-09-15', goalId: goal.id });
    const loose = await createTask({ title: 'loose', anchorDate: '2026-09-15' });
    expect([a.order, b.order]).toEqual([0, 1]);
    expect(loose.order).toBe(0);

    await setGoalActiveTask(goal.id, b.id);
    expect((await getGoal(goal.id))?.activeTaskId).toBe(b.id);

    await deleteTask(b.id);
    expect((await getGoal(goal.id))?.activeTaskId).toBeNull();
  });
});

describe('occurrences', () => {
  it('upserts per task + date', async () => {
    await setOccurrenceStatus('t1', '2026-09-15', 'pending');
    await setOccurrenceStatus('t1', '2026-09-15', 'done');
    const occurrences = await listOccurrencesForTask('t1');
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].status).toBe('done');
  });

  it('queries by inclusive date range', async () => {
    await setOccurrenceStatus('t1', '2026-09-14', 'done');
    await setOccurrenceStatus('t1', '2026-09-16', 'pending');
    await setOccurrenceStatus('t1', '2026-09-20', 'missed');
    const inRange = await listOccurrencesInRange('2026-09-15', '2026-09-19');
    expect(inRange.map((occurrence) => occurrence.date)).toEqual(['2026-09-16']);
  });

  it('deletes by task + date', async () => {
    await setOccurrenceStatus('t1', '2026-09-15', 'done');
    await deleteOccurrence('t1', '2026-09-15');
    expect(await listOccurrencesForTask('t1')).toEqual([]);
  });
});

describe('notes', () => {
  it('creates notes with an empty item list', async () => {
    const note = await createNote({ title: 'Ideas' });
    expect(note.items).toEqual([]);
    expect(await listNotes()).toEqual([note]);
  });

  it('manages embedded list items', async () => {
    const note = await createNote({ title: 'Ideas' });
    const item = await addNoteItem(note.id, 'read a book');
    await updateNoteItem(note.id, item.id, { text: 'read two books' });

    const task = await createTask({ title: 'read', anchorDate: '2026-09-15' });
    await promoteNoteItem(note.id, item.id, { type: 'task', id: task.id });

    const [afterPromote] = (await listNotes())[0].items;
    expect(afterPromote.text).toBe('read two books');
    expect(afterPromote.status).toBe('promoted');
    expect(afterPromote.promotedTo).toEqual({ type: 'task', id: task.id });

    await removeNoteItem(note.id, item.id);
    expect((await listNotes())[0].items).toEqual([]);
  });

  it('tracks checked state and ordering', async () => {
    const note = await createNote({ title: 'Ideas' });
    const a = await addNoteItem(note.id, 'a');
    const b = await addNoteItem(note.id, 'b');
    const c = await addNoteItem(note.id, 'c');
    expect([a.order, b.order, c.order]).toEqual([0, 1, 2]);

    await setNoteItemChecked(note.id, b.id, true);
    await moveNoteItem(note.id, 'nope', 1);
    await moveNoteItem(note.id, c.id, -1);

    const items = (await listNotes())[0].items;
    expect(items.map((entry) => entry.id)).toEqual([a.id, c.id, b.id]);
    expect(items.map((entry) => entry.order)).toEqual([0, 1, 2]);
    expect(items.find((entry) => entry.id === b.id)?.checked).toBe(true);
  });
});

describe('history', () => {
  it('appends entries and lists newest first', async () => {
    await logHistory({ type: 'goal_locked', refId: 'g1', snapshot: { title: 'A' }, timestamp: '2026-09-15T00:00:00.000Z' });
    await logHistory({ type: 'goal_completed', refId: 'g1', timestamp: '2026-09-16T00:00:00.000Z' });
    const history = await listHistory();
    expect(history.map((entry) => entry.type)).toEqual(['goal_completed', 'goal_locked']);
    expect(history[1].snapshot).toEqual({ title: 'A' });
  });
});

describe('export / import', () => {
  it('round-trips every table through the DTO', async () => {
    const goal = await createGoal({ title: 'Ship v1' });
    await createTask({ title: 'write docs', anchorDate: '2026-09-15', goalId: goal.id });
    await createNote({ title: 'Ideas' });
    await logHistory({ type: 'goal_locked', refId: goal.id, snapshot: { title: 'Ship v1' } });

    const dto = await exportData();
    expect(dto.schemaVersion).toBe(1);
    expect(dto.goals).toHaveLength(1);
    expect(dto.tasks).toHaveLength(1);
    expect(dto.notes).toHaveLength(1);
    expect(dto.history).toHaveLength(1);

    await Promise.all(db.tables.map((table) => table.clear()));
    expect(await listGoals()).toHaveLength(0);

    await importData(dto);
    expect(await listGoals()).toHaveLength(1);
    expect(await listTasks()).toHaveLength(1);
    expect(await listNotes()).toHaveLength(1);
    expect(await listHistory()).toHaveLength(1);
  });

  it('is replace-only and backs up current state before wiping', async () => {
    await createGoal({ title: 'keep me' });
    const snapshot = await exportData();
    await createGoal({ title: 'remove me' });
    expect(await listGoals()).toHaveLength(2);

    await importData(snapshot);
    expect((await listGoals()).map((goal) => goal.title)).toEqual(['keep me']);

    const backups = await listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].data.goals.map((goal) => goal.title).sort()).toEqual([
      'keep me',
      'remove me',
    ]);

    await restoreBackup(backups[0].id);
    expect((await listGoals()).map((goal) => goal.title)).toEqual(['remove me', 'keep me']);
  });
});
