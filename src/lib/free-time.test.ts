import { describe, expect, it } from 'vitest';
import { dayFreeTime, timeStringToMinutes } from './free-time.js';
import type { ScheduledTask } from './schedule.js';
import type { Task } from '../db/types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Test',
    goalId: null,
    anchorDate: '2026-09-15',
    recurrence: 'none',
    recurrenceDays: null,
    recurrenceEnd: null,
    sourceNoteId: null,
    order: 0,
    durationMinutes: 30,
    createdAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeScheduled(task: Task): ScheduledTask {
  return { task, date: '2026-09-15', status: 'pending', focused: false };
}

describe('timeStringToMinutes', () => {
  it('converts HH:MM to minutes', () => {
    expect(timeStringToMinutes('07:00')).toBe(420);
    expect(timeStringToMinutes('23:30')).toBe(1410);
    expect(timeStringToMinutes('00:00')).toBe(0);
  });
});

describe('dayFreeTime', () => {
  it('calculates free time with no tasks', () => {
    const result = dayFreeTime([], '07:00', '23:00');
    expect(result.totalMinutes).toBe(960);
    expect(result.bookedMinutes).toBe(0);
    expect(result.freeMinutes).toBe(960);
  });

  it('subtracts task durations', () => {
    const tasks = [
      makeScheduled(makeTask({ durationMinutes: 30 })),
      makeScheduled(makeTask({ id: 't2', durationMinutes: 60 })),
    ];
    const result = dayFreeTime(tasks, '07:00', '23:00');
    expect(result.bookedMinutes).toBe(90);
    expect(result.freeMinutes).toBe(870);
  });

  it('can go negative when over-scheduled', () => {
    const tasks = [makeScheduled(makeTask({ durationMinutes: 600 }))];
    const result = dayFreeTime(tasks, '07:00', '23:00');
    expect(result.freeMinutes).toBe(360);
  });
});
