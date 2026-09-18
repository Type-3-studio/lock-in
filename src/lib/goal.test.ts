import { describe, expect, it } from 'vitest';
import type { Goal } from '../db/types.js';
import {
  GoalTransitionError,
  canLock,
  isEditable,
  isTerminal,
  lockGoal,
  setTerminalStatus,
  timeLeft,
} from './goal.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Ship v1',
    reasons: '',
    specifics: '',
    measure: '',
    deadline: '2026-10-01',
    status: 'draft',
    createdAt: '2026-09-15T00:00:00.000Z',
    lockedAt: null,
    color: null,
    icon: null,
    activeTaskId: null,
    archived: false,
    ...overrides,
  };
}

describe('status predicates', () => {
  it('only drafts are editable', () => {
    expect(isEditable(makeGoal({ status: 'draft' }))).toBe(true);
    expect(isEditable(makeGoal({ status: 'locked' }))).toBe(false);
    expect(isEditable(makeGoal({ status: 'completed' }))).toBe(false);
  });

  it('recognises terminal statuses', () => {
    expect(isTerminal(makeGoal({ status: 'completed' }))).toBe(true);
    expect(isTerminal(makeGoal({ status: 'failed' }))).toBe(true);
    expect(isTerminal(makeGoal({ status: 'abandoned' }))).toBe(true);
    expect(isTerminal(makeGoal({ status: 'locked' }))).toBe(false);
    expect(isTerminal(makeGoal({ status: 'draft' }))).toBe(false);
  });
});

describe('canLock', () => {
  it('requires a draft with a deadline', () => {
    expect(canLock(makeGoal())).toBe(true);
    expect(canLock(makeGoal({ deadline: null }))).toBe(false);
    expect(canLock(makeGoal({ status: 'locked' }))).toBe(false);
  });
});

describe('lockGoal', () => {
  it('locks a draft and stamps lockedAt', () => {
    const locked = lockGoal(makeGoal(), '2026-09-15T12:00:00.000Z');
    expect(locked.status).toBe('locked');
    expect(locked.lockedAt).toBe('2026-09-15T12:00:00.000Z');
  });

  it('refuses to lock a non-draft', () => {
    expect(() => lockGoal(makeGoal({ status: 'locked' }), 'x')).toThrow(GoalTransitionError);
    expect(() => lockGoal(makeGoal({ status: 'completed' }), 'x')).toThrow(GoalTransitionError);
  });

  it('refuses to lock without a deadline', () => {
    expect(() => lockGoal(makeGoal({ deadline: null }), 'x')).toThrow(GoalTransitionError);
  });

  it('does not mutate the original', () => {
    const original = makeGoal();
    lockGoal(original, 'x');
    expect(original.status).toBe('draft');
    expect(original.lockedAt).toBeNull();
  });
});

describe('setTerminalStatus', () => {
  it('moves a locked goal to each terminal status', () => {
    for (const status of ['completed', 'failed', 'abandoned'] as const) {
      expect(setTerminalStatus(makeGoal({ status: 'locked' }), status).status).toBe(status);
    }
  });

  it('refuses transitions from draft or terminal', () => {
    expect(() => setTerminalStatus(makeGoal({ status: 'draft' }), 'completed')).toThrow(
      GoalTransitionError,
    );
    expect(() => setTerminalStatus(makeGoal({ status: 'completed' }), 'failed')).toThrow(
      GoalTransitionError,
    );
  });
});

describe('timeLeft', () => {
  it('is null without a deadline', () => {
    expect(timeLeft(makeGoal({ deadline: null }), '2026-09-15')).toBeNull();
  });

  it('counts down to the deadline', () => {
    expect(timeLeft(makeGoal({ deadline: '2026-10-01' }), '2026-09-15')).toEqual({
      days: 16,
      overdue: false,
    });
  });

  it('reports zero on the due day', () => {
    expect(timeLeft(makeGoal({ deadline: '2026-10-01' }), '2026-10-01')).toEqual({
      days: 0,
      overdue: false,
    });
  });

  it('flags overdue goals', () => {
    expect(timeLeft(makeGoal({ deadline: '2026-10-01' }), '2026-10-05')).toEqual({
      days: 4,
      overdue: true,
    });
  });
});
