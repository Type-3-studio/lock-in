export const MIN_DURATION = 5;
export const DEFAULT_DURATION = 30;
const STEP = 30;

export function increaseDuration(current: number): number {
  return current + STEP;
}

export function decreaseDuration(current: number): number {
  return Math.max(MIN_DURATION, current - STEP);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
