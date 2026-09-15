import type { Goal, Occurrence, Task } from '../db/types.js';
import { addDays, compareDates, type ISODate } from './date-util.js';
import { occurrenceKey, occurrencesForTask } from './recurrence.js';

export interface MissedChange {
  task: Task;
  date: ISODate;
}

/** How far back rollover will look, so a long-lived task can't generate unbounded work. */
export const ROLLOVER_LOOKBACK_DAYS = 366;

/**
 * Past occurrences that are neither done nor already missed. Applied on app open so
 * `pending` days roll over to `missed` — a pure plan; the caller persists + logs it.
 */
export function planMissedRollover(
  tasks: Task[],
  occurrences: Occurrence[],
  goals: Goal[],
  today: ISODate,
): MissedChange[] {
  const yesterday = addDays(today, -1);
  const earliest = addDays(today, -ROLLOVER_LOOKBACK_DAYS);
  const statusByKey = new Map(
    occurrences.map((occurrence) => [
      occurrenceKey(occurrence.taskId, occurrence.date),
      occurrence.status,
    ]),
  );
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  const changes: MissedChange[] = [];
  for (const task of tasks) {
    const goal = task.goalId === null ? undefined : goalById.get(task.goalId);
    const deadline = goal?.deadline ?? null;
    const start = compareDates(task.anchorDate, earliest) > 0 ? task.anchorDate : earliest;
    if (compareDates(start, yesterday) > 0) continue;

    for (const date of occurrencesForTask(task, { start, end: yesterday }, deadline)) {
      const status = statusByKey.get(occurrenceKey(task.id, date));
      if (status === 'done' || status === 'missed') continue;
      changes.push({ task, date });
    }
  }
  return changes;
}
