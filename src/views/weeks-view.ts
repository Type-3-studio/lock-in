import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Goal, Occurrence, Recurrence, Task, TaskStatus } from '../db/types.js';
import {
  createTask,
  deleteOccurrence,
  deleteOccurrencesForTask,
  deleteTask,
  liveGoals,
  liveOccurrencesInRange,
  liveTasks,
  setGoalActiveTask,
  setOccurrenceStatus,
  updateTask,
} from '../db/store.js';
import { logTaskMarked } from '../lib/history.js';
import { todayISO } from '../lib/clock.js';
import { confirmAction } from '../lib/confirm.js';
import {
  addDays,
  addMonths,
  compareDates,
  endOfMonth,
  endOfWeek,
  isoWeek,
  startOfMonth,
  startOfWeek,
  type ISODate,
} from '../lib/date-util.js';
import { dayNumber, longLabel, monthYearLabel, shortLabel } from '../lib/format.js';
import { buildSchedule, type DateRange, type ScheduledTask } from '../lib/schedule.js';
import '../components/week-grid.js';
import type { GridDay } from '../components/week-grid.js';
import '../components/weeks-table.js';
import type { WeekRowModel } from '../components/weeks-table.js';

type Mode = 'week' | 'month';

type Screen =
  | { kind: 'grid' }
  | { kind: 'day'; date: ISODate }
  | { kind: 'task'; taskId: string | null; date: ISODate };

interface TaskForm {
  title: string;
  anchorDate: ISODate;
  recurrence: Recurrence;
  recurrenceDays: number[];
  recurrenceEnd: string;
  goalId: string;
}

const WEEKDAYS: Array<[number, string]> = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [7, 'Sun'],
];

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week',
  custom: 'Custom days',
};

const WEEKS_PER_PAGE = 8;

@customElement('weeks-view')
export class WeeksView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    ion-content {
      --padding-start: 12px;
      --padding-end: 12px;
      --padding-top: 12px;
      --padding-bottom: 12px;
    }

    .subbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--ion-color-step-100, #ededed);
    }

    .subbar ion-segment {
      flex: 1;
    }

    .load-more {
      display: flex;
      justify-content: center;
      padding: 12px 0 4px;
    }

    .day-view {
      display: grid;
      gap: 14px;
      max-width: 640px;
    }

    .day-view > .day-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }

    ul.day-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }

    ul.day-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--ion-color-step-150, #e5e5e5);
      border-radius: 8px;
    }

    ul.day-list li.done .task-title {
      text-decoration: line-through;
      color: var(--ion-color-medium);
    }

    ul.day-list li.missed .task-title {
      color: var(--ion-color-danger);
    }

    .task-title {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
      padding: 0;
    }

    .status-chip {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ion-color-medium);
    }

    .miss-btn {
      border: 1px solid var(--ion-color-step-200, #d4d4d8);
      border-radius: 6px;
      background: transparent;
      color: var(--ion-color-medium);
      font-size: 0.7rem;
      padding: 3px 6px;
      cursor: pointer;
    }

    .task-form {
      display: grid;
      gap: 16px;
      max-width: 640px;
    }

    .task-form label {
      display: grid;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--ion-color-medium);
    }

    .task-form input[type='text'],
    .task-form input[type='date'],
    .task-form select {
      font: inherit;
      font-weight: 400;
      padding: 10px 12px;
      border: 1px solid var(--ion-color-step-200, #d4d4d8);
      border-radius: 8px;
      background: var(--ion-background-color, #fff);
      color: var(--ion-text-color, #111);
    }

    .day-checks {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-weight: 400;
    }

    .day-checks label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 400;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }

    h2 {
      margin: 0 0 4px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ion-color-medium);
    }

    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--ion-color-medium);
    }
  `;

  @state() private goals: Goal[] = [];
  @state() private tasks: Task[] = [];
  @state() private occurrences: Occurrence[] = [];
  @state() private mode: Mode = 'week';
  @state() private weekAnchor: ISODate = startOfWeek(todayISO());
  @state() private weekCount = WEEKS_PER_PAGE;
  @state() private monthStart: ISODate = startOfMonth(todayISO());
  @state() private screen: Screen = { kind: 'grid' };
  @state() private form: TaskForm = this.emptyForm(todayISO());
  @state() private busy = false;

  private subscriptions: Array<{ unsubscribe(): void }> = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.subscriptions = [
      liveGoals().subscribe((goals) => {
        this.goals = goals;
      }),
      liveTasks().subscribe((tasks) => {
        this.tasks = tasks;
      }),
      liveOccurrencesInRange('0000-01-01', '9999-12-31').subscribe((occurrences) => {
        this.occurrences = occurrences;
      }),
    ];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }

  private emptyForm(date: ISODate): TaskForm {
    return {
      title: '',
      anchorDate: date,
      recurrence: 'none',
      recurrenceDays: [],
      recurrenceEnd: '',
      goalId: '',
    };
  }

  private get today(): ISODate {
    return todayISO();
  }

  private get monthRange(): DateRange {
    return { start: startOfWeek(this.monthStart), end: endOfWeek(endOfMonth(this.monthStart)) };
  }

  private get monthDays(): GridDay[] {
    const prefix = this.monthStart.slice(0, 7);
    return buildSchedule(this.tasks, this.occurrences, this.goals, this.monthRange).map((day) => ({
      ...day,
      muted: !day.date.startsWith(prefix),
    }));
  }

  private get weekRows(): WeekRowModel[] {
    const today = this.today;
    const rows: WeekRowModel[] = [];
    for (let index = 0; index < this.weekCount; index += 1) {
      const start = addDays(this.weekAnchor, 7 * index);
      const end = addDays(start, 6);
      rows.push({
        start,
        weekNumber: isoWeek(start).week,
        label: `${shortLabel(start)} – ${shortLabel(end)}`,
        current: compareDates(start, today) <= 0 && compareDates(end, today) >= 0,
        days: buildSchedule(this.tasks, this.occurrences, this.goals, { start, end }).map((day) => ({
          date: day.date,
          dayNumber: dayNumber(day.date),
          tasks: day.tasks,
          today: day.date === today,
        })),
      });
    }
    return rows;
  }

  private dayTasks(date: ISODate): ScheduledTask[] {
    return (
      buildSchedule(this.tasks, this.occurrences, this.goals, { start: date, end: date })[0]?.tasks ??
      []
    );
  }

  private get editingTask(): Task | undefined {
    const screen = this.screen;
    if (screen.kind !== 'task' || screen.taskId === null) return undefined;
    const { taskId } = screen;
    return this.tasks.find((task) => task.id === taskId);
  }

  private get heading(): string {
    const screen = this.screen;
    if (screen.kind === 'task') {
      return screen.taskId === null ? 'New task' : 'Edit task';
    }
    if (screen.kind === 'day') return longLabel(screen.date);
    if (this.mode === 'month') return monthYearLabel(this.monthStart);
    return 'Weeks';
  }

  private prevMonth = (): void => {
    this.monthStart = addMonths(this.monthStart, -1);
  };

  private nextMonth = (): void => {
    this.monthStart = addMonths(this.monthStart, 1);
  };

  private goToday = (): void => {
    this.weekAnchor = startOfWeek(todayISO());
    this.weekCount = WEEKS_PER_PAGE;
    this.monthStart = startOfMonth(todayISO());
  };

  private onModeChange = (event: CustomEvent<{ value?: string }>): void => {
    this.mode = event.detail.value === 'month' ? 'month' : 'week';
  };

  private loadMore = (): void => {
    this.weekCount += WEEKS_PER_PAGE;
  };

  private startCreate(date: ISODate): void {
    this.form = this.emptyForm(date);
    this.screen = { kind: 'task', taskId: null, date };
  }

  private startEdit(taskId: string, date: ISODate): void {
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (task === undefined) return;
    this.form = {
      title: task.title,
      anchorDate: task.anchorDate,
      recurrence: task.recurrence,
      recurrenceDays: task.recurrenceDays ?? [],
      recurrenceEnd: task.recurrenceEnd ?? '',
      goalId: task.goalId ?? '',
    };
    this.screen = { kind: 'task', taskId, date };
  }

  private openDay = (event: CustomEvent<ISODate>): void => {
    this.screen = { kind: 'day', date: event.detail };
  };

  private back = (): void => {
    this.screen = { kind: 'grid' };
  };

  private setField<K extends keyof TaskForm>(field: K, value: TaskForm[K]): void {
    this.form = { ...this.form, [field]: value };
  }

  private toggleDay(day: number, checked: boolean): void {
    const days = checked
      ? [...this.form.recurrenceDays, day].sort((a, b) => a - b)
      : this.form.recurrenceDays.filter((entry) => entry !== day);
    this.setField('recurrenceDays', days);
  }

  private async saveTask(): Promise<void> {
    const screen = this.screen;
    if (screen.kind !== 'task' || this.busy) return;
    const title = this.form.title.trim();
    if (title === '') return;
    this.busy = true;
    const payload = {
      title,
      anchorDate: this.form.anchorDate,
      recurrence: this.form.recurrence,
      recurrenceDays: this.form.recurrence === 'custom' ? this.form.recurrenceDays : null,
      recurrenceEnd: this.form.recurrenceEnd === '' ? null : this.form.recurrenceEnd,
      goalId: this.form.goalId === '' ? null : this.form.goalId,
    };
    try {
      if (screen.taskId !== null) await updateTask(screen.taskId, payload);
      else await createTask(payload);
      this.screen = { kind: 'day', date: this.form.anchorDate };
    } finally {
      this.busy = false;
    }
  }

  private async removeTask(): Promise<void> {
    const screen = this.screen;
    if (screen.kind !== 'task' || screen.taskId === null || this.busy) return;
    const { taskId } = screen;
    const confirmed = await confirmAction({
      header: 'Delete this task?',
      message: 'Its logged history stays, but the task and its occurrences are removed.',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    this.busy = true;
    try {
      await deleteTask(taskId);
      await deleteOccurrencesForTask(taskId);
      this.screen = { kind: 'grid' };
    } finally {
      this.busy = false;
    }
  }

  private statusOf(taskId: string, date: ISODate): TaskStatus {
    return (
      this.occurrences.find((entry) => entry.taskId === taskId && entry.date === date)?.status ??
      'pending'
    );
  }

  private async setFocus(goalId: string, taskId: string | null): Promise<void> {
    await setGoalActiveTask(goalId, taskId);
  }

  private async setStatus(task: Task, date: ISODate, status: TaskStatus): Promise<void> {
    if (status === 'pending') {
      await deleteOccurrence(task.id, date);
      return;
    }
    await setOccurrenceStatus(task.id, date, status);
    await logTaskMarked(task, date, status);
  }

  render(): TemplateResult {
    const showingBack = this.screen.kind !== 'grid';
    return html`
      <ion-header>
        <ion-toolbar>
          ${showingBack
            ? html`<ion-buttons slot="start">
                <ion-button aria-label="Back" @click=${this.back}>
                  <ion-icon slot="icon-only" name="arrow-back-outline"></ion-icon>
                </ion-button>
              </ion-buttons>`
            : this.mode === 'month'
              ? html`<ion-buttons slot="start">
                  <ion-button aria-label="Previous" @click=${this.prevMonth}>
                    <ion-icon slot="icon-only" name="chevron-back-outline"></ion-icon>
                  </ion-button>
                </ion-buttons>`
              : nothing}
          <ion-title>${this.heading}</ion-title>
          ${!showingBack && this.mode === 'month'
            ? html`<ion-buttons slot="end">
                <ion-button aria-label="Next" @click=${this.nextMonth}>
                  <ion-icon slot="icon-only" name="chevron-forward-outline"></ion-icon>
                </ion-button>
              </ion-buttons>`
            : nothing}
        </ion-toolbar>
        ${!showingBack
          ? html`<div class="subbar">
              <ion-segment value=${this.mode} @ionChange=${this.onModeChange}>
                <ion-segment-button value="week">Week</ion-segment-button>
                <ion-segment-button value="month">Month</ion-segment-button>
              </ion-segment>
              <ion-button size="small" fill="clear" @click=${this.goToday}>Today</ion-button>
            </div>`
          : nothing}
      </ion-header>
      <ion-content>${this.renderBody()}</ion-content>
    `;
  }

  private renderBody(): TemplateResult {
    switch (this.screen.kind) {
      case 'task':
        return this.renderTaskForm();
      case 'day':
        return this.renderDay(this.screen.date);
      default:
        return this.mode === 'month' ? this.renderMonth() : this.renderWeeks();
    }
  }

  private renderWeeks(): TemplateResult {
    return html`
      <weeks-table
        .weeks=${this.weekRows}
        @day-select=${(event: CustomEvent<ISODate>) => this.openDay(event)}
      ></weeks-table>
      <div class="load-more">
        <ion-button fill="clear" @click=${this.loadMore}>Load more weeks</ion-button>
      </div>
    `;
  }

  private renderMonth(): TemplateResult {
    return html`
      <week-grid
        .days=${this.monthDays}
        density="compact"
        .today=${this.today}
        @day-open=${(event: CustomEvent<ISODate>) => this.openDay(event)}
      ></week-grid>
    `;
  }

  private renderDay(date: ISODate): TemplateResult {
    const tasks = this.dayTasks(date);
    return html`
      <div class="day-view">
        <p class="day-title">${longLabel(date)}</p>
        ${tasks.length === 0
          ? html`<p class="hint">No tasks yet. Add one to plan this day.</p>`
          : html`
              <ul class="day-list">
                ${tasks.map(
                  (item) => html`
                    <li class=${item.status}>
                      <input
                        type="checkbox"
                        aria-label="Done"
                        .checked=${item.status === 'done'}
                        @change=${(event: Event) =>
                          this.setStatus(
                            item.task,
                            date,
                            (event.target as HTMLInputElement).checked ? 'done' : 'pending',
                          )}
                      />
                      <button
                        class="task-title"
                        @click=${() => this.startEdit(item.task.id, date)}
                      >
                        ${item.focused ? '★ ' : ''}${item.task.title}
                      </button>
                      <span class="status-chip">${item.status}</span>
                      <button
                        class="miss-btn"
                        title="Mark missed"
                        @click=${() => this.setStatus(item.task, date, 'missed')}
                      >
                        miss
                      </button>
                    </li>
                  `,
                )}
              </ul>
            `}
        <div class="actions">
          <ion-button @click=${() => this.startCreate(date)}>+ Add task</ion-button>
        </div>
      </div>
    `;
  }

  private renderTaskForm(): TemplateResult {
    const editing = this.editingTask;
    const date = this.screen.kind === 'task' ? this.screen.date : this.today;
    const status = editing !== undefined ? this.statusOf(editing.id, date) : 'pending';
    const editingGoal =
      editing !== undefined && editing.goalId !== null
        ? this.goals.find((goal) => goal.id === editing.goalId)
        : undefined;
    const isFocus = editing !== undefined && editingGoal?.activeTaskId === editing.id;
    return html`
      <div class="task-form">
        <label>
          Task title
          <input
            type="text"
            .value=${this.form.title}
            placeholder="What needs doing?"
            @input=${(event: Event) =>
              this.setField('title', (event.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            .value=${this.form.anchorDate}
            @input=${(event: Event) =>
              this.setField('anchorDate', (event.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Repeats
          <select
            @change=${(event: Event) =>
              this.setField(
                'recurrence',
                (event.target as HTMLSelectElement).value as Recurrence,
              )}
          >
            ${(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map(
              (value) => html`<option value=${value} ?selected=${this.form.recurrence === value}>
                ${RECURRENCE_LABEL[value]}
              </option>`,
            )}
          </select>
        </label>
        ${this.form.recurrence === 'custom'
          ? html`<div class="day-checks">
              ${WEEKDAYS.map(
                ([day, label]) => html`<label>
                  <input
                    type="checkbox"
                    .checked=${this.form.recurrenceDays.includes(day)}
                    @change=${(event: Event) =>
                      this.toggleDay(day, (event.target as HTMLInputElement).checked)}
                  />
                  ${label}
                </label>`,
              )}
            </div>`
          : nothing}
        ${this.form.recurrence !== 'none'
          ? html`<label>
              Repeat until (optional)
              <input
                type="date"
                .value=${this.form.recurrenceEnd}
                @input=${(event: Event) =>
                  this.setField('recurrenceEnd', (event.target as HTMLInputElement).value)}
              />
            </label>`
          : nothing}
        <label>
          Goal (optional)
          <select
            @change=${(event: Event) =>
              this.setField('goalId', (event.target as HTMLSelectElement).value)}
          >
            <option value="" ?selected=${this.form.goalId === ''}>No goal</option>
            ${this.goals.map(
              (goal) => html`<option value=${goal.id} ?selected=${this.form.goalId === goal.id}>
                ${goal.title}
              </option>`,
            )}
          </select>
        </label>
        ${editing !== undefined && editingGoal !== undefined
          ? html`
              <section>
                <h2>Goal focus</h2>
                <div class="actions">
                  <ion-button
                    fill=${isFocus ? 'solid' : 'outline'}
                    @click=${() => this.setFocus(editingGoal.id, isFocus ? null : editing.id)}
                  >
                    ${isFocus ? '★ Current focus' : 'Set as goal focus'}
                  </ion-button>
                </div>
                <p class="hint">A goal has one focus task — it's highlighted with a ★.</p>
              </section>
            `
          : nothing}
        ${editing !== undefined
          ? html`
              <section>
                <h2>Status for ${longLabel(date)}</h2>
                <div class="actions">
                  <ion-button
                    fill=${status === 'pending' ? 'solid' : 'outline'}
                    @click=${() => this.setStatus(editing, date, 'pending')}
                  >
                    Pending
                  </ion-button>
                  <ion-button
                    color="success"
                    fill=${status === 'done' ? 'solid' : 'outline'}
                    @click=${() => this.setStatus(editing, date, 'done')}
                  >
                    Done
                  </ion-button>
                  <ion-button
                    color="danger"
                    fill=${status === 'missed' ? 'solid' : 'outline'}
                    @click=${() => this.setStatus(editing, date, 'missed')}
                  >
                    Missed
                  </ion-button>
                </div>
              </section>
            `
          : nothing}
        <div class="actions">
          <ion-button fill="clear" @click=${this.back}>Cancel</ion-button>
          ${editing !== undefined
            ? html`<ion-button color="danger" fill="clear" @click=${() => this.removeTask()}>
                Delete
              </ion-button>`
            : nothing}
          <ion-button
            ?disabled=${this.busy || this.form.title.trim() === ''}
            @click=${() => this.saveTask()}
          >
            Save
          </ion-button>
        </div>
        <p class="hint">Recurring tasks generate occurrences; each day is marked on its own.</p>
      </div>
    `;
  }
}
