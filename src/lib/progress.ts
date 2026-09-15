import type { Occurrence, Task } from '../db/types.js';
import type { ISODate } from './date-util.js';
import { occurrenceKey, occurrencesForTask, type DateRange } from './recurrence.js';

export interface GoalProgress {
  done: number;
  total: number;
  /** `done / total`, or `null` when nothing is due in the range yet. */
  ratio: number | null;
}

/**
 * Rolls up per-occurrence state for a goal's tasks over a date range.
 * Only occurrences generated from the given tasks count toward `total`;
 * unknown stored records are ignored.
 */
export function goalProgress(
  tasks: Task[],
  occurrences: Occurrence[],
  range: DateRange,
  deadline: ISODate | null,
): GoalProgress {
  const status = new Map(
    occurrences.map((occurrence) => [
      occurrenceKey(occurrence.taskId, occurrence.date),
      occurrence.status,
    ]),
  );

  let total = 0;
  let done = 0;
  for (const task of tasks) {
    for (const date of occurrencesForTask(task, range, deadline)) {
      total += 1;
      if (status.get(occurrenceKey(task.id, date)) === 'done') done += 1;
    }
  }

  return { done, total, ratio: total === 0 ? null : done / total };
}
