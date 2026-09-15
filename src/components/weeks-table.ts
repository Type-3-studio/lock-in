import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ScheduledTask } from '../lib/schedule.js';
import type { ISODate } from '../lib/date-util.js';

export interface WeekDayCell {
  date: ISODate;
  dayNumber: number;
  tasks: ScheduledTask[];
  today: boolean;
}

export interface WeekRowModel {
  start: ISODate;
  weekNumber: number;
  label: string;
  current: boolean;
  days: WeekDayCell[];
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * A clean weeks table: one row per week (week number + date on the left) and one column
 * per weekday. Day cells summarise their tasks; clicking one opens the day's task manager.
 */
@customElement('weeks-table')
export class WeeksTable extends LitElement {
  static styles = css`
    :host {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    table {
      width: 100%;
      min-width: 560px;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    /* The week column is fixed; the seven weekday columns split the rest equally. */
    thead th:not(.week-col) {
      width: calc((100% - 22%) / 7);
    }

    th,
    td {
      border: 1px solid var(--ion-color-step-150, #dbe2ea);
      padding: 0;
    }

    thead th {
      padding: 8px 6px;
      font-weight: 600;
      color: var(--ion-color-medium);
      background: var(--ion-color-step-50, #f7f9fc);
      text-align: center;
      white-space: nowrap;
    }

    .week-col {
      width: 22%;
      text-align: left;
      padding: 8px 10px;
      background: var(--ion-color-step-50, #f2f6fb);
      vertical-align: middle;
    }

    tr.current .week-col {
      box-shadow: inset 3px 0 0 var(--ion-color-primary);
    }

    .wnum {
      display: block;
      font-weight: 700;
      color: var(--ion-text-color, #111);
    }

    .wrange {
      display: block;
      font-size: 0.72rem;
      font-weight: 400;
      color: var(--ion-color-medium);
    }

    .wbadge {
      display: inline-block;
      margin-top: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ion-color-primary);
    }

    td {
      height: 52px;
      vertical-align: top;
    }

    .day {
      width: 100%;
      height: 100%;
      min-height: 52px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 5px 6px;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .day:hover {
      background: var(--ion-color-step-50, #f7f9fc);
    }

    .day.today {
      background: color-mix(in srgb, var(--ion-color-primary) 10%, transparent);
    }

    .dnum {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--ion-color-medium);
    }

    .day.today .dnum {
      color: var(--ion-color-primary);
    }

    .dots {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--ion-color-medium);
    }

    .dot.done {
      background: var(--ion-color-success);
    }

    .dot.missed {
      background: var(--ion-color-danger);
    }

    .more {
      font-size: 0.62rem;
      color: var(--ion-color-medium);
    }
  `;

  @property({ attribute: false }) weeks: WeekRowModel[] = [];

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    return html`
      <table>
        <thead>
          <tr>
            <th class="week-col">Week</th>
            ${WEEKDAY_LABELS.map((label) => html`<th>${label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${this.weeks.map((week) => this.renderWeek(week))}
        </tbody>
      </table>
    `;
  }

  private renderWeek(week: WeekRowModel): TemplateResult {
    return html`
      <tr class=${week.current ? 'current' : ''}>
        <th class="week-col">
          <span class="wnum">W${week.weekNumber}</span>
          <span class="wrange">${week.label}</span>
          ${week.current ? html`<span class="wbadge">This week</span>` : nothing}
        </th>
        ${week.days.map((day) => this.renderDay(day))}
      </tr>
    `;
  }

  private renderDay(day: WeekDayCell): TemplateResult {
    const visible = day.tasks.slice(0, 4);
    return html`
      <td>
        <button
          class="day ${day.today ? 'today' : ''}"
          aria-label=${`Manage tasks for ${day.date}`}
          @click=${() => this.emit('day-select', day.date)}
        >
          <span class="dnum">${day.dayNumber}</span>
          ${visible.length > 0
            ? html`<span class="dots">
                ${visible.map((item) => html`<span class="dot ${item.status}"></span>`)}
                ${day.tasks.length > visible.length
                  ? html`<span class="more">+${day.tasks.length - visible.length}</span>`
                  : nothing}
              </span>`
            : nothing}
        </button>
      </td>
    `;
  }
}
