import { db } from './db.js';
import { listGoals, listOccurrencesInRange, listTasks, setOccurrenceStatus } from './store.js';
import { logTaskMarked } from '../lib/history.js';
import { ROLLOVER_LOOKBACK_DAYS, planMissedRollover } from '../lib/rollover.js';
import { addDays } from '../lib/date-util.js';
import { todayISO } from '../lib/clock.js';

/**
 * On app open, flip past `pending`/untracked occurrences to `missed` and log each one.
 * Idempotent: already-done and already-missed occurrences are left untouched.
 */
export async function runMissedRollover(): Promise<number> {
  const today = todayISO();
  const windowStart = addDays(today, -ROLLOVER_LOOKBACK_DAYS);

  const [tasks, goals, occurrences] = await Promise.all([
    listTasks(),
    listGoals(),
    listOccurrencesInRange(windowStart, today),
  ]);

  const changes = planMissedRollover(tasks, occurrences, goals, today);
  if (changes.length === 0) return 0;

  await db.transaction('rw', db.occurrences, async () => {
    for (const change of changes) {
      await setOccurrenceStatus(change.task.id, change.date, 'missed');
    }
  });

  for (const change of changes) {
    await logTaskMarked(change.task, change.date, 'missed');
  }

  return changes.length;
}
