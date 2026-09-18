import type { Goal, GoalStatus, HistoryEntry, HistoryType, Task, TaskStatus } from '../db/types.js';
import { logHistory } from '../db/store.js';

export interface GoalSnapshot {
  title: string;
  reasons: string;
  specifics: string;
  measure: string;
  deadline: string | null;
  status: GoalStatus;
  createdAt: string;
  lockedAt: string | null;
  color: string | null;
  icon: string | null;
  archived: boolean;
}

export type SelfRating = 'good' | 'bad';

export interface GoalOutcome {
  rating: SelfRating | null;
  reflection: string;
}

export interface GoalTerminalSnapshot extends GoalSnapshot {
  outcome: GoalOutcome;
}

export interface TaskSnapshot {
  title: string;
  goalId: string | null;
  anchorDate: string;
  recurrence: Task['recurrence'];
  recurrenceDays: number[] | null;
  recurrenceEnd: string | null;
  date: string;
  status: TaskStatus;
  durationMinutes: number;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Clones `value` and freezes the clone so a history snapshot can never be mutated. */
export function snapshot<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

export function goalSnapshot(goal: Goal): GoalSnapshot {
  return snapshot({
    title: goal.title,
    reasons: goal.reasons ?? '',
    specifics: goal.specifics,
    measure: goal.measure,
    deadline: goal.deadline,
    status: goal.status,
    createdAt: goal.createdAt,
    lockedAt: goal.lockedAt,
    color: goal.color,
    icon: goal.icon,
    archived: goal.archived,
  });
}

export function goalTerminalSnapshot(goal: Goal, outcome: GoalOutcome): GoalTerminalSnapshot {
  return snapshot({ ...goalSnapshot(goal), outcome });
}

export function taskSnapshot(task: Task, date: string, status: TaskStatus): TaskSnapshot {
  return snapshot({
    title: task.title,
    goalId: task.goalId,
    anchorDate: task.anchorDate,
    recurrence: task.recurrence,
    recurrenceDays: task.recurrenceDays,
    recurrenceEnd: task.recurrenceEnd,
    date,
    status,
    durationMinutes: task.durationMinutes,
  });
}

/* -------------------------------- Loggers --------------------------------- */

export function logGoalLocked(goal: Goal): Promise<HistoryEntry> {
  return logHistory({ type: 'goal_locked', refId: goal.id, snapshot: goalSnapshot(goal) });
}

export function logGoalTerminal(
  goal: Goal,
  status: Extract<GoalStatus, 'completed' | 'failed' | 'abandoned'>,
  outcome: GoalOutcome = { rating: null, reflection: '' },
): Promise<HistoryEntry> {
  const type = `goal_${status}` as HistoryType;
  return logHistory({ type, refId: goal.id, snapshot: goalTerminalSnapshot(goal, outcome) });
}

export function logTaskMarked(
  task: Task,
  date: string,
  status: Extract<TaskStatus, 'done' | 'missed'>,
): Promise<HistoryEntry> {
  const type: HistoryType = status === 'done' ? 'task_done' : 'task_missed';
  return logHistory({ type, refId: task.id, snapshot: taskSnapshot(task, date, status) });
}
