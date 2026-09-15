import type { Goal, Occurrence, Task, TaskStatus } from '../db/types.js';
import { eachDate, type ISODate } from './date-util.js';
import { occurrenceKey, occurrencesForTask, type DateRange } from './recurrence.js';

export type { DateRange } from './recurrence.js';

export interface ScheduledTask {
  task: Task;
  date: ISODate;
  status: TaskStatus;
  /** True when this task is its goal's current focus. */
  focused: boolean;
}

export interface DaySchedule {
  date: ISODate;
  tasks: ScheduledTask[];
}

/**
 * Expands every task into its occurrences within `range`, applies stored per-occurrence
 * status, and groups them by day. Tasks tied to a goal are clipped at that goal's deadline.
 * Every day in the range is present, even with an empty task list.
 */
export function buildSchedule(
  tasks: Task[],
  occurrences: Occurrence[],
  goals: Goal[],
  range: DateRange,
): DaySchedule[] {
  const statusByKey = new Map(
    occurrences.map((occurrence) => [
      occurrenceKey(occurrence.taskId, occurrence.date),
      occurrence.status,
    ]),
  );
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  const days = new Map<ISODate, ScheduledTask[]>();
  for (const date of eachDate(range.start, range.end)) days.set(date, []);

  for (const task of tasks) {
    const goal = task.goalId === null ? undefined : goalById.get(task.goalId);
    const deadline = goal?.deadline ?? null;
    const focused = goal !== undefined && goal.activeTaskId === task.id;
    for (const date of occurrencesForTask(task, range, deadline)) {
      const bucket = days.get(date);
      if (bucket === undefined) continue;
      bucket.push({
        task,
        date,
        status: statusByKey.get(occurrenceKey(task.id, date)) ?? 'pending',
        focused,
      });
    }
  }

  return [...days.entries()].map(([date, scheduled]) => ({
    date,
    tasks: scheduled.sort(
      (a, b) =>
        Number(b.focused) - Number(a.focused) ||
        (a.task.order ?? 0) - (b.task.order ?? 0) ||
        a.task.createdAt.localeCompare(b.task.createdAt) ||
        a.task.id.localeCompare(b.task.id),
    ),
  }));
}
