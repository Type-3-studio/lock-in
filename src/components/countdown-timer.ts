import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { countdownTo, pad2 } from '../lib/countdown.js';

/**
 * Ticking deadline countdown. Ticks itself so the parent view never re-renders
 * on every second just to move the timer forward.
 */
@customElement('countdown-timer')
export class CountdownTimer extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .countdown {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin-top: 14px;
    }

    .unit {
      display: flex;
      align-items: baseline;
      gap: 4px;
      min-width: 0;
    }

    .num {
      font-size: clamp(1.6rem, 9vw, 2.6rem);
      font-weight: 300;
      line-height: 1;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--ion-text-color);
    }

    .lbl {
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ion-color-medium);
    }

    .countdown.overdue .num {
      color: var(--ion-color-danger);
    }
  `;

  @property() deadline = '';
  @property({ type: Boolean }) overdue = false;

  @state() private now = Date.now();

  private ticker: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.now = Date.now();
    this.ticker = window.setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  render(): TemplateResult {
    const remaining = countdownTo(this.deadline, this.now);
    const summary = this.overdue
      ? `Deadline passed (${this.deadline})`
      : `${remaining.days} days, ${remaining.hours} hours and ${remaining.minutes} minutes remaining`;
    const unit = (value: number, label: string): TemplateResult => html`
      <div class="unit">
        <span class="num">${pad2(value)}</span>
        <span class="lbl">${label}</span>
      </div>
    `;
    return html`
      <div class="countdown ${this.overdue ? 'overdue' : ''}" role="timer" aria-label=${summary}>
        ${unit(remaining.days, 'Day')}
        ${unit(remaining.hours, 'Hrs')}
        ${unit(remaining.minutes, 'Min')}
        ${unit(remaining.seconds, 'Sec')}
      </div>
    `;
  }
}