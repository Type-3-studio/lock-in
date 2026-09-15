import type { Task } from '../db/types.js';
import { compareDates, dayOfWeek, eachDate, type ISODate } from './date-util.js';

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/** Stable key for per-occurrence state (`taskId + date`), shared by store and domain math. */
export function occurrenceKey(taskId: string, date: ISODate): string {
  return `${taskId}@${date}`;
}

function latest(a: ISODate, b: ISODate): ISODate {
  return compareDates(a, b) >= 0 ? a : b;
}

function earliest(a: ISODate, b: ISODate): ISODate {
  return compareDates(a, b) <= 0 ? a : b;
}

function matches(task: Task, date: ISODate): boolean {
  switch (task.recurrence) {
    case 'none':
      return date === task.anchorDate;
    case 'daily':
      return true;
    case 'weekly':
      return dayOfWeek(date) === dayOfWeek(task.anchorDate);
    case 'custom':
      return (task.recurrenceDays ?? []).includes(dayOfWeek(date));
  }
}

/**
 * Deterministically expands a Task template into occurrence dates within `range`.
 * Honors `anchorDate` (no occurrences before it) and `recurrenceEnd` (inclusive).
 * Goal-deadline clipping is applied separately via {@link clipAtDeadline}.
 */
export function generateOccurrences(task: Task, range: DateRange): ISODate[] {
  if (compareDates(range.start, range.end) > 0) return [];

  let end = range.end;
  if (task.recurrenceEnd !== null) end = earliest(end, task.recurrenceEnd);
  if (compareDates(task.anchorDate, end) > 0) return [];

  const start = latest(range.start, task.anchorDate);
  const dates: ISODate[] = [];
  for (const date of eachDate(start, end)) {
    if (matches(task, date)) dates.push(date);
  }
  return dates;
}

/** Pure clip of occurrence dates at a goal deadline (inclusive). `null` deadline is a no-op. */
export function clipAtDeadline(dates: ISODate[], deadline: ISODate | null): ISODate[] {
  if (deadline === null) return dates;
  return dates.filter((date) => compareDates(date, deadline) <= 0);
}

/** Full pipeline: expand a task within a range, then clip at the owning goal's deadline. */
export function occurrencesForTask(
  task: Task,
  range: DateRange,
  deadline: ISODate | null,
): ISODate[] {
  return clipAtDeadline(generateOccurrences(task, range), deadline);
}
