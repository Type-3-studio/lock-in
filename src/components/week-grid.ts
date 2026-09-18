import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ScheduledTask } from '../lib/schedule.js';
import type { ISODate } from '../lib/date-util.js';
import { dayNumber, longLabel, weekdayShort } from '../lib/format.js';

export type GridDensity = 'full' | 'compact';

export interface GridDay {
  date: ISODate;
  tasks: ScheduledTask[];
  muted?: boolean;
  /** Whether this day is part of the deadline progress line. */
  deadlineLine?: boolean;
}

export interface TaskSelectDetail {
  taskId: string;
  date: ISODate;
}

export interface TaskToggleDetail {
  taskId: string;
  date: ISODate;
  done: boolean;
}

/**
 * Presentational day grid. `density="full"` shows task chips with a done toggle and an
 * add button; `density="compact"` shows status dots and opens the day on tap.
 */
@customElement('week-grid')
export class WeekGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
      min-width: 560px;
    }

    .day {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      padding: 6px;
      border: 1px solid var(--ion-color-step-150);
      border-radius: 10px;
      background: var(--ion-background-color);
    }

    .day.compact {
      min-height: 56px;
      cursor: pointer;
    }

    .day.full {
      min-height: 120px;
    }

    .day.today {
      border-color: var(--ion-color-primary);
      box-shadow: inset 0 0 0 1px var(--ion-color-primary);
    }

    .day.muted {
      opacity: 0.45;
    }

    .day-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 4px;
      font-size: 0.72rem;
      color: var(--ion-color-medium);
    }

    .daynum {
      font-weight: 700;
      color: var(--ion-text-color, #111);
    }

    .day-tasks {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .task {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      padding: 3px 4px;
      border-left: 3px solid var(--ion-color-medium);
      border-radius: 5px;
      background: var(--ion-color-step-50);
      font-size: 0.75rem;
      cursor: pointer;
    }

    .task.status-done {
      border-left-color: var(--ion-color-success);
      opacity: 0.7;
    }

    .task.status-missed {
      border-left-color: var(--ion-color-danger);
      opacity: 0.7;
    }

    .task.focused {
      background: var(--ion-color-primary-tint, #ede9fe);
      box-shadow: inset 0 0 0 1px var(--ion-color-primary);
    }

    .focus-star {
      flex: none;
      color: var(--ion-color-primary);
      font-size: 10px;
      line-height: 1;
    }

    .task .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task.status-done .title {
      text-decoration: line-through;
    }

    .check {
      flex: none;
      width: 16px;
      height: 16px;
      padding: 0;
      display: grid;
      place-items: center;
      border: 1px solid var(--ion-color-medium);
      border-radius: 50%;
      background: transparent;
      color: var(--ion-color-success);
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
    }

    .add {
      margin-top: auto;
      align-self: flex-start;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 1px dashed var(--ion-color-medium);
      border-radius: 6px;
      background: transparent;
      color: var(--ion-color-medium);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    }

    .dots {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      align-items: center;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ion-color-medium);
    }

    .dot.status-done {
      background: var(--ion-color-success);
    }

    .dot.status-missed {
      background: var(--ion-color-danger);
    }

    .more {
      font-size: 0.65rem;
      color: var(--ion-color-medium);
    }

    .deadline-line {
      position: relative;
    }

    .deadline-line::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--ion-color-danger);
      border-radius: 2px;
    }
  `;

  @property({ attribute: false }) days: GridDay[] = [];
  @property() density: GridDensity = 'full';
  @property() today = '';

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    return html`<div class="grid">${this.days.map((day) => this.renderDay(day))}</div>`;
  }

  private renderDay(day: GridDay): TemplateResult {
    const compact = this.density === 'compact';
    const classes = [
      'day',
      this.density,
      day.date === this.today ? 'today' : '',
      day.muted ? 'muted' : '',
      day.deadlineLine ? 'deadline-line' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const openDay = (): void => this.emit('day-open', day.date);
    return html`
      <div
        class=${classes}
        role=${compact ? 'button' : nothing}
        tabindex=${compact ? 0 : nothing}
        aria-label=${compact ? `${longLabel(day.date)}, ${day.tasks.length} tasks` : nothing}
        @click=${compact ? openDay : nothing}
        @keydown=${compact
          ? (event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDay();
              }
            }
          : nothing}
      >
        <div class="day-head">
          <span class="weekday">${weekdayShort(day.date)}</span>
          <span class="daynum">${dayNumber(day.date)}</span>
        </div>
        ${compact
          ? html`<div class="dots">${this.renderDots(day)}</div>`
          : html`
              <div class="day-tasks">${day.tasks.map((item) => this.renderTask(item))}</div>
              <button
                class="add"
                aria-label="Add task"
                @click=${() => this.emit('cell-add', day.date)}
              >
                +
              </button>
            `}
      </div>
    `;
  }

  private renderTask(item: ScheduledTask): TemplateResult {
    const select = (): void =>
      this.emit<TaskSelectDetail>('task-select', { taskId: item.task.id, date: item.date });
    return html`
      <div
        class="task status-${item.status} ${item.focused ? 'focused' : ''}"
        title=${item.focused ? `Focus: ${item.task.title}` : item.task.title}
        role="button"
        tabindex="0"
        @click=${select}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select();
          }
        }}
      >
        <button
          class="check"
          aria-label=${item.status === 'done' ? 'Mark not done' : 'Mark done'}
          aria-pressed=${item.status === 'done'}
          @click=${(event: Event) => {
            event.stopPropagation();
            this.emit<TaskToggleDetail>('task-toggle', {
              taskId: item.task.id,
              date: item.date,
              done: item.status !== 'done',
            });
          }}
        >
          ${item.status === 'done' ? '✓' : ''}
        </button>
        ${item.focused ? html`<span class="focus-star" aria-label="Focus">★</span>` : nothing}
        <span class="title">${item.task.title}</span>
      </div>
    `;
  }

  private renderDots(day: GridDay): TemplateResult | typeof nothing {
    if (day.tasks.length === 0) return nothing;
    const visible = day.tasks.slice(0, 5);
    return html`
      ${visible.map((item) => html`<span class="dot status-${item.status}"></span>`)}
      ${day.tasks.length > visible.length
        ? html`<span class="more">+${day.tasks.length - visible.length}</span>`
        : nothing}
    `;
  }
}
