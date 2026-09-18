import type {
  Goal,
  HistoryEntry,
  ListItem,
  Note,
  Occurrence,
  Settings,
  Task,
} from '../db/types.js';

export const SCHEMA_VERSION = 2;

export interface ExportDto {
  schemaVersion: number;
  exportedAt: string;
  goals: Goal[];
  tasks: Task[];
  occurrences: Occurrence[];
  notes: Note[];
  history: HistoryEntry[];
  settings?: Settings;
}

export interface ExportState {
  goals: Goal[];
  tasks: Task[];
  occurrences: Occurrence[];
  notes: Note[];
  history: HistoryEntry[];
  settings?: Settings;
}

const COLLECTIONS = ['goals', 'tasks', 'occurrences', 'notes', 'history'] as const;
type CollectionKey = (typeof COLLECTIONS)[number];

export function createExport(state: ExportState, exportedAt: string): ExportDto {
  return { schemaVersion: SCHEMA_VERSION, exportedAt, ...state };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnum(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

const GOAL_STATUSES = ['draft', 'locked', 'completed', 'failed', 'abandoned'] as const;
const TASK_STATUSES = ['pending', 'done', 'missed'] as const;
const RECURRENCES = ['none', 'daily', 'weekly', 'custom'] as const;
const LIST_STATUSES = ['idle', 'promoted'] as const;
const HISTORY_TYPES = [
  'goal_locked',
  'goal_completed',
  'goal_failed',
  'goal_abandoned',
  'task_done',
  'task_missed',
] as const;

type Check = (row: Record<string, unknown>, table: CollectionKey, index: number) => void;

/** Keeps only the known fields, so unknown keys in an imported file never persist. */
function pick(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) out[key] = row[key];
  }
  return out;
}

function fail(table: CollectionKey, index: number, detail: string): never {
  throw new Error(`Invalid ${table} row #${index}: ${detail}`);
}

function requireString(row: Record<string, unknown>, key: string, table: CollectionKey, index: number): void {
  if (!(key in row) || typeof row[key] !== 'string') fail(table, index, `"${key}" must be a string.`);
}

function optionalString(row: Record<string, unknown>, key: string): void {
  const value = row[key];
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error(`"${key}" must be a string or null.`);
  }
}

function requireNumber(row: Record<string, unknown>, key: string, table: CollectionKey, index: number): void {
  if (typeof row[key] !== 'number') fail(table, index, `"${key}" must be a number.`);
}

function requireNullableString(row: Record<string, unknown>, key: string, table: CollectionKey, index: number): void {
  const value = row[key];
  if (value !== null && typeof value !== 'string') fail(table, index, `"${key}" must be null or a string.`);
}

function requireEnum(
  row: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  table: CollectionKey,
  index: number,
): void {
  if (!isEnum(row[key], allowed)) {
    fail(table, index, `"${key}" must be one of: ${allowed.join(', ')}.`);
  }
}

function parseItems(value: unknown, table: CollectionKey, index: number): ListItem[] {
  if (!Array.isArray(value)) fail(table, index, '"items" must be an array.');
  return value.map((entry, i) => {
    if (!isRecord(entry)) fail(table, index, `items[${i}] must be an object.`);
    ensureId(entry, table, `items[${i}]`);
    if (typeof entry.text !== 'string') fail(table, index, `items[${i}] "text" must be a string.`);
    if (typeof entry.checked !== 'boolean') fail(table, index, `items[${i}] "checked" must be a boolean.`);
    if (!isEnum(entry.status, LIST_STATUSES)) fail(table, index, `items[${i}] "status" is invalid.`);
    if (typeof entry.order !== 'number') fail(table, index, `items[${i}] "order" must be a number.`);
    if (entry.promotedTo !== null && !isRecord(entry.promotedTo)) {
      fail(table, index, `items[${i}] "promotedTo" must be null or an object.`);
    }
    return { ...pick(entry, ['id', 'text', 'checked', 'status', 'promotedTo', 'order']) } as unknown as ListItem;
  });
}

const COLLECTION_KEYS: Record<CollectionKey, readonly string[]> = {
  goals: ['id', 'title', 'reasons', 'specifics', 'measure', 'deadline', 'status', 'createdAt', 'lockedAt', 'color', 'icon', 'activeTaskId', 'archived'],
  tasks: ['id', 'title', 'goalId', 'anchorDate', 'recurrence', 'recurrenceDays', 'recurrenceEnd', 'sourceNoteId', 'order', 'durationMinutes', 'createdAt'],
  occurrences: ['id', 'taskId', 'date', 'status'],
  notes: ['id', 'title', 'body', 'items', 'createdAt'],
  history: ['id', 'type', 'refId', 'snapshot', 'timestamp'],
};

const COLLECTION_CHECKS: Record<CollectionKey, Check> = {
  goals: (row, table, index) => {
    requireString(row, 'title', table, index);
    requireEnum(row, 'status', GOAL_STATUSES, table, index);
    requireString(row, 'createdAt', table, index);
    optionalString(row, 'reasons');
    optionalString(row, 'specifics');
    optionalString(row, 'measure');
    requireNullableString(row, 'deadline', table, index);
    requireNullableString(row, 'lockedAt', table, index);
    requireNullableString(row, 'color', table, index);
    requireNullableString(row, 'icon', table, index);
    requireNullableString(row, 'activeTaskId', table, index);
    if ('archived' in row && typeof row.archived !== 'boolean') {
      fail(table, index, '"archived" must be a boolean.');
    }
  },
  tasks: (row, table, index) => {
    requireString(row, 'title', table, index);
    requireString(row, 'anchorDate', table, index);
    requireEnum(row, 'recurrence', RECURRENCES, table, index);
    requireNullableString(row, 'goalId', table, index);
    requireNullableString(row, 'recurrenceEnd', table, index);
    requireNullableString(row, 'sourceNoteId', table, index);
    requireNumber(row, 'durationMinutes', table, index);
    requireString(row, 'createdAt', table, index);
    const days = row.recurrenceDays;
    if (days !== null && days !== undefined) {
      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        !days.every((day) => typeof day === 'number' && day >= 1 && day <= 7)
      ) {
        fail(table, index, '"recurrenceDays" must be a non-empty array of ISO weekdays (1-7).');
      }
    }
  },
  occurrences: (row, table, index) => {
    requireString(row, 'taskId', table, index);
    requireString(row, 'date', table, index);
    requireEnum(row, 'status', TASK_STATUSES, table, index);
  },
  notes: (row, table, index) => {
    requireString(row, 'title', table, index);
    requireString(row, 'createdAt', table, index);
    optionalString(row, 'body');
    if ('items' in row) {
      const items = parseItems(row.items, table, index);
      row.items = items;
    }
  },
  history: (row, table, index) => {
    requireEnum(row, 'type', HISTORY_TYPES, table, index);
    requireString(row, 'refId', table, index);
    requireString(row, 'timestamp', table, index);
  },
};

function ensureId(row: Record<string, unknown>, table: CollectionKey, label: string): void {
  if (typeof row.id !== 'string' || row.id === '') {
    throw new Error(`Invalid ${table} ${label}: missing id.`);
  }
}

function parseCollection(
  table: CollectionKey,
  value: unknown,
  seenIds: Set<string>,
): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Import is missing the "${table}" array.`);
  }
  const check = COLLECTION_CHECKS[table];
  const keys = COLLECTION_KEYS[table];
  return value.map((entry, index) => {
    if (!isRecord(entry)) fail(table, index, 'expected an object.');
    const row = pick(entry, keys);
    ensureId(row, table, `row #${index}`);
    if (seenIds.has(row.id as string)) {
      fail(table, index, `duplicate id "${row.id as string}".`);
    }
    seenIds.add(row.id as string);
    check(row, table, index);
    return row;
  });
}

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) throw new Error('Import "settings" must be an object.');
  if (value.id !== undefined && value.id !== 'default') {
    throw new Error('Import "settings" id must be "default".');
  }
  if (typeof value.wakeTime !== 'string' || typeof value.bedTime !== 'string') {
    throw new Error('Import "settings" wakeTime/bedTime must be strings.');
  }
  if (typeof value.showDeadlineLine !== 'boolean') {
    throw new Error('Import "settings" showDeadlineLine must be a boolean.');
  }
  return {
    id: 'default',
    wakeTime: value.wakeTime,
    bedTime: value.bedTime,
    showDeadlineLine: value.showDeadlineLine,
  } as Settings;
}

/** Validates an untrusted value (parsed JSON) into an {@link ExportDto}. Throws on mismatch. */
export function parseExport(value: unknown): ExportDto {
  if (!isRecord(value)) {
    throw new Error('Import must be a JSON object.');
  }
  // Accept v1 (no settings) or v2 (with settings)
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    throw new Error(
      `Unsupported schemaVersion ${String(value.schemaVersion)} (expected 1 or 2).`,
    );
  }
  const seenIds = new Set<string>();
  const goal = parseCollection('goals', value.goals, seenIds) as Goal[];
  const task = parseCollection('tasks', value.tasks, seenIds) as Task[];
  const occurrence = parseCollection('occurrences', value.occurrences, seenIds) as Occurrence[];
  const note = parseCollection('notes', value.notes, seenIds) as Note[];
  const history = parseCollection('history', value.history, seenIds) as HistoryEntry[];
  const result: ExportDto = {
    schemaVersion: value.schemaVersion,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    goals: goal,
    tasks: task,
    occurrences: occurrence,
    notes: note,
    history,
  };
  if (value.settings !== undefined) {
    result.settings = parseSettings(value.settings);
  }
  return result;
}

export function parseExportJson(text: string): ExportDto {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Import file is not valid JSON.');
  }
  return parseExport(value);
}