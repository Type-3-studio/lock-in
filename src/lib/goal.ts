import type { Goal, GoalStatus } from '../db/types.js';
import { diffDays, type ISODate } from './date-util.js';

export type TerminalStatus = Extract<GoalStatus, 'completed' | 'failed' | 'abandoned'>;

export function isEditable(goal: Goal): boolean {
  return goal.status === 'draft';
}

export function isTerminal(goal: Goal): boolean {
  return goal.status === 'completed' || goal.status === 'failed' || goal.status === 'abandoned';
}

export function canLock(goal: Goal): boolean {
  return goal.status === 'draft' && goal.deadline !== null;
}

export class GoalTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoalTransitionError';
  }
}

/** Draft → locked. The only irreversible transition and the only one that sets `lockedAt`. */
export function lockGoal(goal: Goal, lockedAt: string): Goal {
  if (goal.status !== 'draft') {
    throw new GoalTransitionError(`Cannot lock a ${goal.status} goal`);
  }
  if (goal.deadline === null) {
    throw new GoalTransitionError('A goal needs a deadline before it can be locked');
  }
  return { ...goal, status: 'locked', lockedAt };
}

/** Locked → terminal. Terminal is permanent: terminal goals can never transition again. */
export function setTerminalStatus(goal: Goal, status: TerminalStatus): Goal {
  if (goal.status !== 'locked') {
    throw new GoalTransitionError(`Cannot mark a ${goal.status} goal as ${status}`);
  }
  return { ...goal, status };
}

export interface TimeLeft {
  days: number;
  overdue: boolean;
}

/** Pure countdown derived from `deadline`; never stored. */
export function timeLeft(goal: Goal, today: ISODate): TimeLeft | null {
  if (goal.deadline === null) return null;
  const remaining = diffDays(goal.deadline, today);
  return { days: Math.abs(remaining), overdue: remaining < 0 };
}
