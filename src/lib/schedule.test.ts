import { describe, expect, it } from 'vitest';
import type { Goal, Occurrence, Task, TaskStatus } from '../db/types.js';
import { buildSchedule } from './schedule.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Goal',
    reasons: '',
    specifics: '',
    measure: '',
    deadline: null,
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    goalId: null,
    anchorDate: '2026-09-14',
    recurrence: 'none',
    recurrenceDays: null,
    recurrenceEnd: null,
    sourceNoteId: null,
    order: 0,
    createdAt: '2026-09-14T00:00:00.000Z',
    durationMinutes: 30,
    ...overrides,
  };
}

function occurrence(taskId: string, date: string, status: TaskStatus): Occurrence {
  return { id: `${taskId}@${date}`, taskId, date, status };
}

const week = { start: '2026-09-14', end: '2026-09-20' };

describe('buildSchedule', () => {
  it('includes every day in the range, even empty ones', () => {
    const days = buildSchedule([], [], [], week);
    expect(days.map((day) => day.date)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
    expect(days.every((day) => day.tasks.length === 0)).toBe(true);
  });

  it('places a one-off task on its anchor day with pending status by default', () => {
    const days = buildSchedule([makeTask()], [], [], week);
    const day = days.find((entry) => entry.date === '2026-09-14');
    expect(day?.tasks).toHaveLength(1);
    expect(day?.tasks[0]).toMatchObject({ date: '2026-09-14', status: 'pending' });
  });

  it('applies stored occurrence statuses', () => {
    const task = makeTask({ recurrence: 'daily' });
    const days = buildSchedule(
      [task],
      [occurrence('t1', '2026-09-15', 'done'), occurrence('t1', '2026-09-16', 'missed')],
      [],
      week,
    );
    const status = (date: string): TaskStatus | undefined =>
      days.find((day) => day.date === date)?.tasks[0]?.status;
    expect(status('2026-09-14')).toBe('pending');
    expect(status('2026-09-15')).toBe('done');
    expect(status('2026-09-16')).toBe('missed');
  });

  it("clips a goal-linked task at the goal's deadline", () => {
    const goal = makeGoal({ deadline: '2026-09-16' });
    const task = makeTask({ goalId: 'g1', recurrence: 'daily' });
    const days = buildSchedule([task], [], [goal], week);
    const scheduledDates = days
      .filter((day) => day.tasks.length > 0)
      .map((day) => day.date);
    expect(scheduledDates).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
  });

  it('orders tasks within a day by creation time', () => {
    const older = makeTask({ id: 'a', createdAt: '2026-09-01T00:00:00.000Z' });
    const newer = makeTask({ id: 'b', createdAt: '2026-09-02T00:00:00.000Z' });
    const days = buildSchedule([newer, older], [], [], week);
    expect(days[0].tasks.map((item) => item.task.id)).toEqual(['a', 'b']);
  });

  it("marks a goal's focus task and sorts it first", () => {
    const goal = makeGoal({ deadline: '2026-10-01', activeTaskId: 't2' });
    const first = makeTask({ id: 't1', goalId: 'g1', createdAt: '2026-09-01T00:00:00.000Z' });
    const focused = makeTask({
      id: 't2',
      goalId: 'g1',
      order: 1,
      createdAt: '2026-09-05T00:00:00.000Z',
    });
    const day = buildSchedule([first, focused], [], [goal], week).find(
      (entry) => entry.date === '2026-09-14',
    );
    expect(day?.tasks.map((item) => item.task.id)).toEqual(['t2', 't1']);
    expect(day?.tasks[0].focused).toBe(true);
    expect(day?.tasks[1].focused).toBe(false);
  });
});
