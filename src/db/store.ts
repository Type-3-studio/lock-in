import { liveQuery, type Observable } from 'dexie';
import type {
  Goal,
  GoalStatus,
  HistoryEntry,
  HistoryType,
  ListItem,
  Note,
  Occurrence,
  Recurrence,
  Settings,
  Task,
  TaskStatus,
} from './types.js';
import { db } from './db.js';
import type { Backup } from './db.js';
import { newId } from '../lib/id.js';
import { occurrenceKey } from '../lib/recurrence.js';
import { moveListItem, promoteItem } from '../lib/list.js';
import { createExport, type ExportDto } from '../lib/dto.js';

let lastTimestamp = 0;

/** Monotonic ISO timestamp: strictly increasing even within the same millisecond. */
function now(): string {
  const current = Date.now();
  lastTimestamp = current > lastTimestamp ? current : lastTimestamp + 1;
  return new Date(lastTimestamp).toISOString();
}

export function occurrenceId(taskId: string, date: string): string {
  return occurrenceKey(taskId, date);
}

/* ---------------------------------- Goals --------------------------------- */

export interface GoalDraft {
  title: string;
  reasons?: string;
  specifics?: string;
  measure?: string;
  deadline?: string | null;
  status?: GoalStatus;
  color?: string | null;
  icon?: string | null;
}

export async function createGoal(draft: GoalDraft): Promise<Goal> {
  const goal: Goal = {
    id: newId(),
    title: draft.title,
    reasons: draft.reasons ?? '',
    specifics: draft.specifics ?? '',
    measure: draft.measure ?? '',
    deadline: draft.deadline ?? null,
    status: draft.status ?? 'draft',
    createdAt: now(),
    lockedAt: null,
    color: draft.color ?? null,
    icon: draft.icon ?? null,
    activeTaskId: null,
    archived: false,
  };
  await db.goals.add(goal);
  return goal;
}

export function getGoal(id: string): Promise<Goal | undefined> {
  return db.goals.get(id);
}

export function listGoals(): Promise<Goal[]> {
  return db.goals.orderBy('createdAt').reverse().toArray();
}

export function updateGoal(
  id: string,
  changes: Partial<Omit<Goal, 'id' | 'createdAt'>>,
): Promise<number> {
  return db.goals.update(id, changes);
}

export function deleteGoal(id: string): Promise<void> {
  return db.goals.delete(id);
}

export function liveGoals(): Observable<Goal[]> {
  return liveQuery(() => db.goals.orderBy('createdAt').reverse().toArray());
}

/* ---------------------------------- Tasks --------------------------------- */

export interface TaskDraft {
  title: string;
  anchorDate: string;
  goalId?: string | null;
  recurrence?: Recurrence;
  recurrenceDays?: number[] | null;
  recurrenceEnd?: string | null;
  sourceNoteId?: string | null;
  durationMinutes?: number;
}

export async function createTask(draft: TaskDraft): Promise<Task> {
  const goalId = draft.goalId ?? null;
  const task: Task = {
    id: newId(),
    title: draft.title,
    goalId,
    anchorDate: draft.anchorDate,
    recurrence: draft.recurrence ?? 'none',
    recurrenceDays: draft.recurrenceDays ?? null,
    recurrenceEnd: draft.recurrenceEnd ?? null,
    sourceNoteId: draft.sourceNoteId ?? null,
    order: 0,
    durationMinutes: draft.durationMinutes ?? 30,
    createdAt: now(),
  };
  // Read-modify-write inside a transaction so concurrent creates serialize and
  // each task gets a unique `order` within its goal group.
  await db.transaction('rw', db.tasks, async () => {
    const order =
      goalId === null
        ? (await db.tasks.toArray()).filter((row) => row.goalId === null).length
        : await db.tasks.where('goalId').equals(goalId).count();
    task.order = order;
    await db.tasks.add(task);
  });
  return task;
}

function byOrderThenCreated(a: Task, b: Task): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export async function listTasks(goalId?: string): Promise<Task[]> {
  const tasks =
    goalId === undefined
      ? await db.tasks.toArray()
      : await db.tasks.where('goalId').equals(goalId).toArray();
  return tasks.sort(byOrderThenCreated);
}

export function updateTask(
  id: string,
  changes: Partial<Omit<Task, 'id' | 'createdAt'>>,
): Promise<number> {
  return db.tasks.update(id, changes);
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', [db.tasks, db.goals], async () => {
    await db.tasks.delete(id);
    await db.goals
      .filter((goal) => goal.activeTaskId === id)
      .modify({ activeTaskId: null });
  });
}

/** Points a goal at (or away from) the single task it should focus on. */
export async function setGoalActiveTask(goalId: string, taskId: string | null): Promise<void> {
  await db.goals.update(goalId, { activeTaskId: taskId });
}

export function liveTasks(goalId?: string): Observable<Task[]> {
  return liveQuery(() => listTasks(goalId));
}

/* ------------------------------- Occurrences ------------------------------ */

export async function setOccurrenceStatus(
  taskId: string,
  date: string,
  status: TaskStatus,
): Promise<Occurrence> {
  const occurrence: Occurrence = { id: occurrenceId(taskId, date), taskId, date, status };
  await db.occurrences.put(occurrence);
  return occurrence;
}

export function listOccurrencesForTask(taskId: string): Promise<Occurrence[]> {
  return db.occurrences.where('taskId').equals(taskId).sortBy('date');
}

export function listOccurrencesInRange(start: string, end: string): Promise<Occurrence[]> {
  return db.occurrences.where('date').between(start, end, true, true).sortBy('date');
}

export function deleteOccurrence(taskId: string, date: string): Promise<void> {
  return db.occurrences.delete(occurrenceId(taskId, date));
}

export function deleteOccurrencesForTask(taskId: string): Promise<number> {
  return db.occurrences.where('taskId').equals(taskId).delete();
}

export function liveOccurrencesInRange(start: string, end: string): Observable<Occurrence[]> {
  return liveQuery(() => listOccurrencesInRange(start, end));
}

/** Full date range used by views that subscribe to every occurrence at once. */
export const ALL_TIME_START = '0000-01-01';
export const ALL_TIME_END = '9999-12-31';

/* ---------------------------------- Notes --------------------------------- */

export interface NoteDraft {
  title: string;
  body?: string;
  items?: ListItem[];
}

export async function createNote(draft: NoteDraft): Promise<Note> {
  const note: Note = {
    id: newId(),
    title: draft.title,
    body: draft.body ?? '',
    items: draft.items ?? [],
    createdAt: now(),
  };
  await db.notes.add(note);
  return note;
}

export function listNotes(): Promise<Note[]> {
  return db.notes.orderBy('createdAt').reverse().toArray();
}

export function updateNote(
  id: string,
  changes: Partial<Omit<Note, 'id' | 'createdAt'>>,
): Promise<number> {
  return db.notes.update(id, changes);
}

export function deleteNote(id: string): Promise<void> {
  return db.notes.delete(id);
}

export function liveNotes(): Observable<Note[]> {
  return liveQuery(() => listNotes());
}

export async function addNoteItem(noteId: string, text: string): Promise<ListItem> {
  const item: ListItem = {
    id: newId(),
    text,
    checked: false,
    status: 'idle',
    promotedTo: null,
    order: 0,
  };
  await db.notes.where('id').equals(noteId).modify((note) => {
    item.order = note.items.length;
    note.items = [...note.items, item];
  });
  return item;
}

export async function updateNoteItem(
  noteId: string,
  itemId: string,
  changes: Partial<Omit<ListItem, 'id'>>,
): Promise<void> {
  await db.notes.where('id').equals(noteId).modify((note) => {
    note.items = note.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item));
  });
}

export async function setNoteItemChecked(
  noteId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  await updateNoteItem(noteId, itemId, { checked });
}

export async function moveNoteItem(
  noteId: string,
  itemId: string,
  delta: number,
): Promise<void> {
  await db.notes.where('id').equals(noteId).modify((note) => {
    note.items = moveListItem(note.items, itemId, delta);
  });
}

export async function promoteNoteItem(
  noteId: string,
  itemId: string,
  promotedTo: NonNullable<ListItem['promotedTo']>,
): Promise<void> {
  await db.notes.where('id').equals(noteId).modify((note) => {
    note.items = note.items.map((item) =>
      item.id === itemId ? promoteItem(item, promotedTo) : item,
    );
  });
}

export async function removeNoteItem(noteId: string, itemId: string): Promise<void> {
  await db.notes.where('id').equals(noteId).modify((note) => {
    note.items = note.items.filter((item) => item.id !== itemId);
  });
}

/* -------------------------------- Settings -------------------------------- */

export const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  wakeTime: '07:00',
  bedTime: '23:00',
  showDeadlineLine: true,
};

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('default');
  return existing ?? DEFAULT_SETTINGS;
}

export function liveSettings(): Observable<Settings> {
  return liveQuery(() => getSettings());
}

export async function updateSettings(
  changes: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...changes });
}

/* --------------------------------- History -------------------------------- */

export interface HistoryInput {
  type: HistoryType;
  refId: string;
  snapshot?: unknown;
  timestamp?: string;
}

export async function logHistory(input: HistoryInput): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    id: newId(),
    type: input.type,
    refId: input.refId,
    snapshot: input.snapshot ?? null,
    timestamp: input.timestamp ?? now(),
  };
  await db.history.add(entry);
  return entry;
}

export function listHistory(): Promise<HistoryEntry[]> {
  return db.history.orderBy('timestamp').reverse().toArray();
}

export function liveHistory(): Observable<HistoryEntry[]> {
  return liveQuery(() => listHistory());
}

/* -------------------------------- Backups --------------------------------- */
/* Import is replace-only, so current state is always snapshotted first.       */

const BACKUP_LIMIT = 5;

export async function exportData(): Promise<ExportDto> {
  const [goals, tasks, occurrences, notes, history, settings] = await Promise.all([
    db.goals.toArray(),
    db.tasks.toArray(),
    db.occurrences.toArray(),
    db.notes.toArray(),
    db.history.toArray(),
    getSettings(),
  ]);
  return createExport({ goals, tasks, occurrences, notes, history, settings }, now());
}

/** Replace-only import. Backs up current state to the `backups` table before wiping. */
export async function importData(dto: ExportDto): Promise<void> {
  const backup: Backup = { id: newId(), createdAt: now(), data: await exportData() };
  await db.transaction(
    'rw',
    [db.goals, db.tasks, db.occurrences, db.notes, db.history, db.backups, db.settings],
    async () => {
      await db.backups.add(backup);
      await db.goals.clear();
      await db.tasks.clear();
      await db.occurrences.clear();
      await db.notes.clear();
      await db.history.clear();
      await db.goals.bulkAdd(dto.goals);
      await db.tasks.bulkAdd(dto.tasks);
      await db.occurrences.bulkAdd(dto.occurrences);
      await db.notes.bulkAdd(dto.notes);
      await db.history.bulkAdd(dto.history);
      // Only touch settings when the DTO carries them — a v1 export has none,
      // and silently wiping the user's schedule prefs would be destructive.
      if (dto.settings !== undefined) {
        await db.settings.clear();
        await db.settings.put(dto.settings);
      }
    },
  );
  await pruneBackups();
}

export function listBackups(): Promise<Backup[]> {
  return db.backups.orderBy('createdAt').reverse().toArray();
}

export function liveBackups(): Observable<Backup[]> {
  return liveQuery(() => listBackups());
}

/** Restores a backup (itself backed up first by {@link importData}). */
export async function restoreBackup(id: string): Promise<void> {
  const backup = await db.backups.get(id);
  if (backup === undefined) return;
  await importData(backup.data);
}

async function pruneBackups(keep = BACKUP_LIMIT): Promise<void> {
  const backups = await listBackups();
  const stale = backups.slice(keep);
  if (stale.length > 0) await db.backups.bulkDelete(stale.map((backup) => backup.id));
}
