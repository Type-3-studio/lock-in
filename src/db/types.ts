export type GoalStatus = 'draft' | 'locked' | 'completed' | 'failed' | 'abandoned';

export type TaskStatus = 'pending' | 'done' | 'missed';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'custom';

export type ListItemStatus = 'idle' | 'promoted';

export interface Goal {
  id: string;
  title: string;
  /** Why this matters — the reasons that keep you going. */
  reasons: string;
  specifics: string;
  measure: string;
  deadline: string | null;
  status: GoalStatus;
  createdAt: string;
  lockedAt: string | null;
  color: string | null;
  icon: string | null;
  /** The single task this goal should be focused on right now, if any. */
  activeTaskId: string | null;
  /** When true, goal is hidden from the main list. */
  archived: boolean;
}

export interface Task {
  id: string;
  title: string;
  goalId: string | null;
  anchorDate: string;
  recurrence: Recurrence;
  /** ISO weekdays (Mon=1..Sun=7) used when `recurrence` is `custom`. */
  recurrenceDays: number[] | null;
  recurrenceEnd: string | null;
  sourceNoteId: string | null;
  /** Sort key within the task's goal (or the unfiled group). */
  order: number;
  /** Estimated duration in minutes (default 30, minimum 5). */
  durationMinutes: number;
  createdAt: string;
}

export interface Occurrence {
  id: string;
  taskId: string;
  date: string;
  status: TaskStatus;
}

export interface ListItem {
  id: string;
  text: string;
  checked: boolean;
  status: ListItemStatus;
  promotedTo: { type: 'task' | 'goal'; id: string } | null;
  /** Sort key within a note (0-based). */
  order: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  items: ListItem[];
  createdAt: string;
}

export type HistoryType =
  | 'goal_locked'
  | 'goal_completed'
  | 'goal_failed'
  | 'goal_abandoned'
  | 'task_done'
  | 'task_missed'
  | 'week_note_added';

export interface HistoryEntry {
  id: string;
  type: HistoryType;
  refId: string;
  snapshot: unknown;
  timestamp: string;
}

export interface Settings {
  /** Singleton key — always `'default'`. */
  id: string;
  /** Wake time in "HH:MM" format (24h). */
  wakeTime: string;
  /** Bed time in "HH:MM" format (24h). */
  bedTime: string;
  /** Whether to show the deadline progress line on the weeks calendar. */
  showDeadlineLine: boolean;
}
