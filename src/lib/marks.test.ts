import { describe, expect, it } from 'vitest';
import { buildDeadlineLineSpans } from './marks.js';
import type { Goal } from '../db/types.js';
import type { ISODate } from './date-util.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Ship v1',
    reasons: '',
    specifics: '',
    measure: '',
    deadline: '2026-09-20',
    status: 'locked',
    createdAt: '2026-09-01T00:00:00.000Z',
    lockedAt: '2026-09-01T00:00:00.000Z',
    color: null,
    icon: null,
    activeTaskId: null,
    archived: false,
    ...overrides,
  };
}

describe('buildDeadlineLineSpans', () => {
  it('returns empty set when showLine is false', () => {
    const spans = buildDeadlineLineSpans([makeGoal()], '2026-09-15', { start: '2026-09-15', end: '2026-09-20' }, false);
    expect(spans.size).toBe(0);
  });

  it('spans from today to deadline for locked goals', () => {
    const spans = buildDeadlineLineSpans(
      [makeGoal()],
      '2026-09-15',
      { start: '2026-09-15', end: '2026-09-20' },
      true,
    );
    // Sep 15..20 = 6 days
    expect(spans.size).toBe(6);
    expect(spans.has('2026-09-15' as ISODate)).toBe(true);
    expect(spans.has('2026-09-20' as ISODate)).toBe(true);
  });

  it('skips non-locked goals', () => {
    const spans = buildDeadlineLineSpans(
      [makeGoal({ status: 'draft' })],
      '2026-09-15',
      { start: '2026-09-15', end: '2026-09-20' },
      true,
    );
    expect(spans.size).toBe(0);
  });

  it('skips goals without deadline', () => {
    const spans = buildDeadlineLineSpans(
      [makeGoal({ deadline: null })],
      '2026-09-15',
      { start: '2026-09-15', end: '2026-09-20' },
      true,
    );
    expect(spans.size).toBe(0);
  });
});
