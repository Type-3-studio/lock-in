import type { Goal, Note, Task } from '../db/types.js';
import { eachDate, compareDates, type ISODate } from './date-util.js';
import type { DateRange } from './recurrence.js';
import { occurrencesForTask } from './recurrence.js';

export type MarkKind = 'deadline' | 'task' | 'note' | 'milestone';

export interface CalendarMark {
  date: ISODate;
  kind: MarkKind;
  color: string;
  label: string;
}

/** Build marks for a date range from goals (deadlines), tasks, and notes. */
export function buildCalendarMarks(
  goals: Goal[],
  tasks: Task[],
  notes: Note[],
  range: DateRange,
): CalendarMark[] {
  const marks: CalendarMark[] = [];

  for (const goal of goals) {
    if (goal.deadline !== null && goal.deadline >= range.start && goal.deadline <= range.end) {
      marks.push({
        date: goal.deadline,
        kind: 'deadline',
        color: 'var(--ion-color-danger)',
        label: `Deadline: ${goal.title}`,
      });
    }
  }

  const datesInTask = new Set<string>();
  for (const task of tasks) {
    const deadline = goals.find((g) => g.id === task.goalId)?.deadline ?? null;
    for (const date of occurrencesForTask(task, range, deadline)) {
      datesInTask.add(date);
    }
  }
  for (const date of datesInTask) {
    marks.push({
      date,
      kind: 'task',
      color: 'var(--ion-color-primary)',
      label: 'Task',
    });
  }

  for (const note of notes) {
    const created = note.createdAt.slice(0, 10);
    if (created >= range.start && created <= range.end) {
      marks.push({
        date: created as ISODate,
        kind: 'note',
        color: 'var(--ion-color-warning)',
        label: note.title,
      });
    }
  }

  return marks;
}

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
