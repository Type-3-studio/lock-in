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

interface TaskRow {
  id: string;
  durationMinutes?: number;
}

interface GoalRow {
  id: string;
  archived?: boolean;
}

// v3 added `durationMinutes` to Task — backfill old rows so day free-time
// summing can never produce `NaN`.
db.version(3)
  .stores({
    goals: 'id, status, deadline, createdAt',
    tasks: 'id, goalId, anchorDate, recurrence, createdAt',
    occurrences: 'id, taskId, date, [taskId+date], status',
    notes: 'id, createdAt',
    history: 'id, type, refId, timestamp',
    backups: 'id, createdAt',
    settings: 'id',
  })
  .upgrade((trans) =>
    trans
      .table<TaskRow>('tasks')
      .toCollection()
      .modify((task) => {
        if (task.durationMinutes === undefined) {
          task.durationMinutes = 30;
        }
      }),
  );

// v4 added `archived` to Goal — backfill so old goals drop out of none of the
// queries and always carry the field in exports/snapshots.
db.version(4)
  .stores({
    goals: 'id, status, deadline, createdAt, archived',
    tasks: 'id, goalId, anchorDate, recurrence, createdAt',
    occurrences: 'id, taskId, date, [taskId+date], status',
    notes: 'id, createdAt',
    history: 'id, type, refId, timestamp',
    backups: 'id, createdAt',
    settings: 'id',
  })
  .upgrade((trans) =>
    trans
      .table<GoalRow>('goals')
      .toCollection()
      .modify((goal) => {
        if (goal.archived === undefined) {
          goal.archived = false;
        }
      }),
  );

// v5: drop indexes the app never queries (pure write overhead). Only the
// indexes actually used by store.ts queries are kept.
db.version(5).stores({
  goals: 'id, createdAt',
  tasks: 'id, goalId',
  occurrences: 'id, taskId, date',
  notes: 'id, createdAt',
  history: 'id, timestamp',
  backups: 'id, createdAt',
  settings: 'id',
});