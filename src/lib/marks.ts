import type { Goal } from '../db/types.js';
import { eachDate, compareDates, type ISODate } from './date-util.js';
import type { DateRange } from './recurrence.js';

/**
 * Returns the set of dates that should show the deadline progress line.
 * For each locked goal with a deadline, the line spans from today (or range start)
 * to the deadline, clipped to the visible range.
 */
export function buildDeadlineLineSpans(
  goals: Goal[],
  today: ISODate,
  range: DateRange,
  showLine: boolean,
): Set<ISODate> {
  const result = new Set<ISODate>();
  if (!showLine) return result;

  for (const goal of goals) {
    if (goal.status !== 'locked' || goal.deadline === null) continue;

    const lineStart = compareDates(today, range.start) < 0 ? range.start : today;
    const lineEnd = goal.deadline;

    if (compareDates(lineEnd, lineStart) < 0) continue;

    for (const date of eachDate(lineStart, lineEnd)) {
      if (date >= range.start && date <= range.end) {
        result.add(date);
      }
    }
  }

  return result;
}