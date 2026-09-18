import Dexie, { type EntityTable } from 'dexie';
import type { Goal, Task, Occurrence, Note, HistoryEntry, Settings } from './types.js';
import type { ExportDto } from '../lib/dto.js';

export interface Backup {
  id: string;
  createdAt: string;
  data: ExportDto;
}

export type LockInDb = Dexie & {
  goals: EntityTable<Goal, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  occurrences: EntityTable<Occurrence, 'id'>;
  notes: EntityTable<Note, 'id'>;
  history: EntityTable<HistoryEntry, 'id'>;
  backups: EntityTable<Backup, 'id'>;
  settings: EntityTable<Settings, 'id'>;
};

export const db = new Dexie('lock-in') as LockInDb;

db.version(1).stores({
  goals: 'id, status, deadline, createdAt',
  tasks: 'id, goalId, anchorDate, recurrence, createdAt',
  occurrences: 'id, taskId, date, [taskId+date], status',
  notes: 'id, createdAt',
  history: 'id, type, refId, timestamp',
});

db.version(2).stores({
  goals: 'id, status, deadline, createdAt',
  tasks: 'id, goalId, anchorDate, recurrence, createdAt',
  occurrences: 'id, taskId, date, [taskId+date], status',
  notes: 'id, createdAt',
  history: 'id, type, refId, timestamp',
  backups: 'id, createdAt',
});

db.version(3).stores({
  goals: 'id, status, deadline, createdAt',
  tasks: 'id, goalId, anchorDate, recurrence, createdAt',
  occurrences: 'id, taskId, date, [taskId+date], status',
  notes: 'id, createdAt',
  history: 'id, type, refId, timestamp',
  backups: 'id, createdAt',
  settings: 'id',
});

db.version(4).stores({
  goals: 'id, status, deadline, createdAt, archived',
  tasks: 'id, goalId, anchorDate, recurrence, createdAt',
  occurrences: 'id, taskId, date, [taskId+date], status',
  notes: 'id, createdAt',
  history: 'id, type, refId, timestamp',
  backups: 'id, createdAt',
  settings: 'id',
});
