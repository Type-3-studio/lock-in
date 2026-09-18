import { addDays, type ISODate } from './date-util.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  overdue: boolean;
}

/**
 * A deadline day runs until its final instant, so the countdown targets the next day's local
 * midnight. Pure: `nowMs` is passed in rather than read from the clock.
 */
export function deadlineInstant(deadline: ISODate): number {
  return new Date(`${addDays(deadline, 1)}T00:00:00`).getTime();
}

export function countdownTo(deadline: ISODate, nowMs: number): Countdown {
  const remaining = deadlineInstant(deadline) - nowMs;
  const total = Math.max(0, remaining);
  return {
    days: Math.floor(total / DAY_MS),
    hours: Math.floor((total % DAY_MS) / HOUR_MS),
    minutes: Math.floor((total % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((total % MINUTE_MS) / SECOND_MS),
    overdue: remaining <= 0,
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
