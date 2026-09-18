import type { ScheduledTask } from './schedule.js';

export interface DayFreeTime {
  /** Total available minutes between wake and bed. */
  totalMinutes: number;
  /** Sum of task durations scheduled for this day. */
  bookedMinutes: number;
  /** totalMinutes - bookedMinutes (can be negative if over-scheduled). */
  freeMinutes: number;
}

export function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function dayFreeTime(
  tasks: ScheduledTask[],
  wakeTime: string,
  bedTime: string,
): DayFreeTime {
  const wake = timeStringToMinutes(wakeTime);
  const bed = timeStringToMinutes(bedTime);
  const totalMinutes = bed - wake;
  const bookedMinutes = tasks.reduce((sum, item) => sum + item.task.durationMinutes, 0);
  return { totalMinutes, bookedMinutes, freeMinutes: totalMinutes - bookedMinutes };
}
