import type { ISODate } from './date-util.js';

/** Presentation-only date formatting. Parses the date as local midnight for display. */
function toDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00`);
}

export function weekdayShort(date: ISODate): string {
  return toDate(date).toLocaleDateString(undefined, { weekday: 'short' });
}

export function dayNumber(date: ISODate): number {
  return Number(date.slice(8, 10));
}

export function shortLabel(date: ISODate): string {
  return toDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function monthYearLabel(date: ISODate): string {
  return toDate(date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function longLabel(date: ISODate): string {
  return toDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function timestampLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}
