export function nowIso(): string {
  return new Date().toISOString();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return localISODate(new Date());
}

/** Converts a stored instant (ISO timestamp) to its local calendar date `YYYY-MM-DD`. */
export function isoDateOf(timestamp: string): string {
  return localISODate(new Date(timestamp));
}
