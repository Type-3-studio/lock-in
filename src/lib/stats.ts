import type { HistoryEntry } from '../db/types.js';
import { diffDays } from './date-util.js';

export interface CompletedGoalStat {
  title: string;
  days: number;
}

export interface HistoryStats {
  locked: number;
  completed: number;
  failed: number;
  abandoned: number;
  tasksDone: number;
  tasksMissed: number;
  averageDaysToComplete: number | null;
  completedGoals: CompletedGoalStat[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function datePart(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null;
}

/** Aggregate, read-only stats derived entirely from the append-only history log. */
export function historyStats(entries: HistoryEntry[]): HistoryStats {
  const stats: HistoryStats = {
    locked: 0,
    completed: 0,
    failed: 0,
    abandoned: 0,
    tasksDone: 0,
    tasksMissed: 0,
    averageDaysToComplete: null,
    completedGoals: [],
  };
  const durations: number[] = [];

  for (const entry of entries) {
    switch (entry.type) {
      case 'goal_locked':
        stats.locked += 1;
        break;
      case 'goal_completed': {
        stats.completed += 1;
        const snapshot = asRecord(entry.snapshot);
        const title = typeof snapshot?.title === 'string' ? snapshot.title : 'Untitled goal';
        const start = datePart(snapshot?.lockedAt) ?? datePart(snapshot?.createdAt);
        const end = datePart(entry.timestamp);
        if (start !== null && end !== null) {
          const days = Math.max(diffDays(end, start), 0);
          durations.push(days);
          stats.completedGoals.push({ title, days });
        }
        break;
      }
      case 'goal_failed':
        stats.failed += 1;
        break;
      case 'goal_abandoned':
        stats.abandoned += 1;
        break;
      case 'task_done':
        stats.tasksDone += 1;
        break;
      case 'task_missed':
        stats.tasksMissed += 1;
        break;
      default:
        break;
    }
  }

  stats.averageDaysToComplete =
    durations.length === 0 ? null : durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return stats;
}
