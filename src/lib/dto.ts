import type {
  Goal,
  HistoryEntry,
  Note,
  Occurrence,
  Task,
} from '../db/types.js';

export const SCHEMA_VERSION = 1;

export interface ExportDto {
  schemaVersion: number;
  exportedAt: string;
  goals: Goal[];
  tasks: Task[];
  occurrences: Occurrence[];
  notes: Note[];
  history: HistoryEntry[];
}

export interface ExportState {
  goals: Goal[];
  tasks: Task[];
  occurrences: Occurrence[];
  notes: Note[];
  history: HistoryEntry[];
}

const COLLECTIONS = ['goals', 'tasks', 'occurrences', 'notes', 'history'] as const;

export function createExport(state: ExportState, exportedAt: string): ExportDto {
  return { schemaVersion: SCHEMA_VERSION, exportedAt, ...state };
}

/** Validates an untrusted value (parsed JSON) into an {@link ExportDto}. Throws on mismatch. */
export function parseExport(value: unknown): ExportDto {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Import must be a JSON object.');
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${String(candidate.schemaVersion)} (expected ${SCHEMA_VERSION}).`,
    );
  }
  for (const key of COLLECTIONS) {
    if (!Array.isArray(candidate[key])) {
      throw new Error(`Import is missing the "${key}" array.`);
    }
  }
  return candidate as unknown as ExportDto;
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
