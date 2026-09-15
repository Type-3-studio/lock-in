import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Goal, GoalStatus, Occurrence, Task } from '../db/types.js';
import {
  createGoal,
  deleteGoal,
  liveGoals,
  liveOccurrencesInRange,
  liveTasks,
  updateGoal,
} from '../db/store.js';
import { logGoalLocked, logGoalTerminal, type SelfRating } from '../lib/history.js';
import { isoDateOf, nowIso, todayISO } from '../lib/clock.js';
import { confirmAction } from '../lib/confirm.js';
import { addDays, diffDays } from '../lib/date-util.js';
import { goalProgress } from '../lib/progress.js';
import { quoteFor } from '../lib/quotes.js';
import {
  canLock,
  isEditable,
  isTerminal,
  lockGoal,
  setTerminalStatus,
  timeLeft,
  type TerminalStatus,
} from '../lib/goal.js';

type Screen =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'close'; id: string; status: TerminalStatus };

interface DraftForm {
  title: string;
  reasons: string;
  specifics: string;
  measure: string;
  deadline: string;
}

interface OutcomeForm {
  rating: SelfRating | null;
  reflection: string;
}

const EMPTY_FORM: DraftForm = { title: '', reasons: '', specifics: '', measure: '', deadline: '' };
const EMPTY_OUTCOME: OutcomeForm = { rating: null, reflection: '' };
const WIZARD_STEPS = 3;

const STATUS_LABEL: Record<GoalStatus, string> = {
  draft: 'Draft',
  locked: 'Locked',
  completed: 'Completed',
  failed: 'Failed',
  abandoned: 'Abandoned',
};

const STATUS_COLOR: Record<GoalStatus, string> = {
  draft: 'medium',
  locked: 'primary',
  completed: 'success',
  failed: 'danger',
  abandoned: 'warning',
};

@customElement('goals-view')
export class GoalsView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    ion-content {
      --padding-start: 16px;
      --padding-end: 16px;
      --padding-top: 16px;
      --padding-bottom: 16px;
    }

    .ion-text-wrap {
      white-space: normal;
    }

    .empty {
      display: grid;
      justify-items: center;
      gap: 12px;
      padding: 64px 24px;
      text-align: center;
      color: var(--ion-color-medium);
    }

    .empty ion-icon {
      font-size: 48px;
    }

    .goal-form,
    .wizard,
    .detail {
      display: grid;
      gap: 16px;
      max-width: 640px;
    }

    .goal-form label,
    .wizard label {
      display: grid;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--ion-color-medium);
    }

    .goal-form input,
    .goal-form textarea,
    .wizard input,
    .wizard textarea {
      font: inherit;
      font-weight: 400;
      padding: 10px 12px;
      border: 1px solid var(--ion-color-step-200, #d4d4d8);
      border-radius: 8px;
      background: var(--ion-background-color, #fff);
      color: var(--ion-text-color, #111);
      resize: vertical;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .detail-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .detail-head h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .detail section h2,
    .wizard h2,
    .close h2 {
      margin: 0 0 4px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ion-color-medium);
    }

    .wizard h2,
    .close h2 {
      font-size: 1rem;
      text-transform: none;
      letter-spacing: 0;
      color: var(--ion-text-color, #111);
    }

    .detail section p {
      margin: 0;
      white-space: pre-wrap;
    }

    .detail blockquote {
      margin: 0;
      padding-left: 12px;
      border-left: 3px solid var(--ion-color-primary);
      color: var(--ion-color-medium);
    }

    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--ion-color-medium);
    }

    .quote {
      max-width: 40ch;
      margin: 0;
      padding: 8px 12px;
      border-left: 3px solid var(--ion-color-primary);
      font-style: italic;
      color: var(--ion-color-medium);
    }

    .quote cite {
      display: block;
      margin-top: 4px;
      font-size: 0.8rem;
      font-style: normal;
    }

    .steps {
      display: flex;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }

    ion-progress-bar {
      border-radius: 4px;
      overflow: hidden;
    }
  `;

  @state() private goals: Goal[] = [];
  @state() private tasks: Task[] = [];
  @state() private occurrences: Occurrence[] = [];
  @state() private screen: Screen = { kind: 'list' };
  @state() private step = 0;
  @state() private form: DraftForm = { ...EMPTY_FORM };
  @state() private outcome: OutcomeForm = { ...EMPTY_OUTCOME };
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

  private goalById(id: string): Goal | undefined {
    return this.goals.find((goal) => goal.id === id);
  }

  private get heading(): string {
    switch (this.screen.kind) {
      case 'create':
        return 'New goal';
      case 'edit':
        return 'Edit draft';
      case 'close':
        return 'Close goal';
      case 'detail':
        return this.goalById(this.screen.id)?.title ?? 'Goal';
      default:
        return 'Goals';
    }
  }

  private startCreate(): void {
    this.form = { ...EMPTY_FORM };
    this.step = 0;
    this.screen = { kind: 'create' };
  }

  private open(id: string): void {
    this.screen = { kind: 'detail', id };
  }

  private startEdit(goal: Goal): void {
    this.form = {
      title: goal.title,
      reasons: goal.reasons ?? '',
      specifics: goal.specifics,
      measure: goal.measure,
      deadline: goal.deadline ?? '',
    };
    this.screen = { kind: 'edit', id: goal.id };
  }

  private restart(goal: Goal): void {
    this.form = {
      title: goal.title,
      reasons: goal.reasons ?? '',
      specifics: goal.specifics,
      measure: goal.measure,
      deadline: '',
    };
    this.step = 0;
    this.screen = { kind: 'create' };
  }

  private back = (): void => {
    if (this.screen.kind === 'create' && this.step > 0) {
      this.step -= 1;
      return;
    }
    this.screen = { kind: 'list' };
  };

  private setField(field: keyof DraftForm, value: string): void {
    this.form = { ...this.form, [field]: value };
  }

  private fieldInput(field: keyof DraftForm) {
    return (event: Event): void => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      this.setField(field, target.value);
    };
  }

  private pickDeadline(days: number): void {
    this.setField('deadline', addDays(todayISO(), days));
  }

  private get canAdvance(): boolean {
    return this.step !== 0 || this.form.title.trim() !== '';
  }

  private nextStep(): void {
    if (!this.canAdvance) return;
    this.step = Math.min(this.step + 1, WIZARD_STEPS - 1);
  }

  private prevStep = (): void => {
    this.step = Math.max(this.step - 1, 0);
  };

  private onSave = (): void => {
    void this.saveDraft();
  };

  private async saveDraft(): Promise<void> {
    const title = this.form.title.trim();
    if (title === '' || this.busy) return;
    this.busy = true;
    const changes = {
      title,
      reasons: this.form.reasons.trim(),
      specifics: this.form.specifics.trim(),
      measure: this.form.measure.trim(),
      deadline: this.form.deadline === '' ? null : this.form.deadline,
    };
    try {
      if (this.screen.kind === 'create') {
        const goal = await createGoal(changes);
        this.screen = { kind: 'detail', id: goal.id };
      } else if (this.screen.kind === 'edit') {
        const { id } = this.screen;
        await updateGoal(id, changes);
        this.screen = { kind: 'detail', id };
      }
    } finally {
      this.busy = false;
    }
  }

  private async lock(goal: Goal): Promise<void> {
    if (!canLock(goal)) return;
    const confirmed = await confirmAction({
      header: 'Lock this goal in?',
      message:
        'Once locked, the deadline is fixed and you cannot quit or change it. This cannot be undone.',
      confirmText: 'Lock in',
    });
    if (!confirmed) return;
    const next = lockGoal(goal, nowIso());
    await updateGoal(goal.id, { status: next.status, lockedAt: next.lockedAt });
    await logGoalLocked(next);
  }

  private startClose(goal: Goal, status: TerminalStatus): void {
    this.outcome = { ...EMPTY_OUTCOME };
    this.screen = { kind: 'close', id: goal.id, status };
  }

  private setRating(rating: SelfRating): void {
    this.outcome = { ...this.outcome, rating: this.outcome.rating === rating ? null : rating };
  }

  private setReflection(value: string): void {
    this.outcome = { ...this.outcome, reflection: value };
  }

  private async submitClose(goal: Goal, status: TerminalStatus): Promise<void> {
    if (goal.status !== 'locked' || this.busy) return;
    this.busy = true;
    try {
      const next = setTerminalStatus(goal, status);
      await updateGoal(goal.id, { status: next.status });
      await logGoalTerminal(next, status, this.outcome);
      this.screen = { kind: 'detail', id: goal.id };
    } finally {
      this.busy = false;
    }
  }

  private async removeDraft(goal: Goal): Promise<void> {
    if (!isEditable(goal)) return;
    const confirmed = await confirmAction({
      header: 'Delete this draft?',
      message: 'Drafts can be deleted. Locked goals can never be deleted.',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    await deleteGoal(goal.id);
    this.screen = { kind: 'list' };
  }

  render(): TemplateResult {
    const showBack = this.screen.kind !== 'list';
    return html`
      <ion-header>
        <ion-toolbar>
          ${showBack
            ? html`<ion-buttons slot="start">
                <ion-button aria-label="Back" @click=${this.back}>
                  <ion-icon slot="icon-only" name="arrow-back-outline"></ion-icon>
                </ion-button>
              </ion-buttons>`
            : nothing}
          <ion-title>${this.heading}</ion-title>
          ${this.screen.kind === 'list'
            ? html`<ion-buttons slot="end">
                <ion-button aria-label="New goal" @click=${this.startCreate}>
                  <ion-icon slot="icon-only" name="add-outline"></ion-icon>
                </ion-button>
              </ion-buttons>`
            : nothing}
        </ion-toolbar>
      </ion-header>
      <ion-content>${this.renderBody()}</ion-content>
    `;
  }

  private renderBody(): TemplateResult {
    switch (this.screen.kind) {
      case 'create':
        return this.renderWizard();
      case 'edit':
        return this.renderEditForm();
      case 'close': {
        const goal = this.goalById(this.screen.id);
        return goal
          ? this.renderClose(goal, this.screen.status)
          : this.renderList();
      }
      case 'detail': {
        const goal = this.goalById(this.screen.id);
        return goal ? this.renderDetail(goal) : this.renderList();
      }
      default:
        return this.renderList();
    }
  }

  private renderList(): TemplateResult {
    if (this.goals.length === 0) {
      return html`
        <div class="empty">
          <ion-icon name="flag-outline"></ion-icon>
          <p>No goals yet. Create a goal, commit to a deadline, and lock it in.</p>
          <ion-button @click=${this.startCreate}>Create a goal</ion-button>
          ${this.renderQuote('lock-in')}
        </div>
      `;
    }
    return html`<ion-list>${this.goals.map((goal) => this.renderListItem(goal))}</ion-list>`;
  }

  private renderListItem(goal: Goal): TemplateResult {
    const meta: string[] = [];
    if (goal.deadline !== null) meta.push(`due ${goal.deadline}`);
    if (goal.status === 'locked') {
      const left = timeLeft(goal, todayISO());
      if (left !== null) meta.push(left.overdue ? `${left.days}d overdue` : `${left.days}d left`);
    }
    return html`
      <ion-item button @click=${() => this.open(goal.id)}>
        <ion-label class="ion-text-wrap">
          <h2>${goal.title}</h2>
          <p>${meta.join(' · ')}</p>
        </ion-label>
        <ion-badge slot="end" color=${STATUS_COLOR[goal.status]}>
          ${STATUS_LABEL[goal.status]}
        </ion-badge>
      </ion-item>
    `;
  }

  private textField(
    field: keyof DraftForm,
    label: string,
    placeholder: string,
    rows = 0,
  ): TemplateResult {
    const handler = this.fieldInput(field);
    return html`
      <label>
        ${label}
        ${rows > 0
          ? html`<textarea
              rows=${rows}
              .value=${this.form[field]}
              placeholder=${placeholder}
              @input=${handler}
            ></textarea>`
          : html`<input .value=${this.form[field]} placeholder=${placeholder} @input=${handler} />`}
      </label>
    `;
  }

  private renderWizard(): TemplateResult {
    const last = this.step === WIZARD_STEPS - 1;
    const days = this.form.deadline === '' ? null : diffDays(this.form.deadline, todayISO());
    return html`
      <div class="wizard">
        <div class="steps">Step ${this.step + 1} of ${WIZARD_STEPS}</div>
        ${this.step === 0
          ? html`
              <h2>What are you committing to?</h2>
              ${this.textField('title', 'Goal title', 'What are you committing to?')}
              ${this.textField(
                'reasons',
                'Why does this matter?',
                'Your reasons keep you going when motivation runs out.',
                3,
              )}
            `
          : nothing}
        ${this.step === 1
          ? html`
              <h2>What does done look like?</h2>
              ${this.textField(
                'specifics',
                'Be specific',
                'Future you has to know exactly when this is finished.',
                3,
              )}
              ${this.textField(
                'measure',
                'How will you measure it?',
                'Optional. A number, a checklist, a result.',
                2,
              )}
            `
          : nothing}
        ${this.step === 2
          ? html`
              <h2>When will it be done?</h2>
              <div class="actions">
                <ion-button size="small" fill="outline" @click=${() => this.pickDeadline(7)}>
                  1 week
                </ion-button>
                <ion-button size="small" fill="outline" @click=${() => this.pickDeadline(14)}>
                  2 weeks
                </ion-button>
                <ion-button size="small" fill="outline" @click=${() => this.pickDeadline(30)}>
                  1 month
                </ion-button>
              </div>
              <label>
                Deadline
                <input
                  type="date"
                  .value=${this.form.deadline}
                  @input=${this.fieldInput('deadline')}
                />
              </label>
              ${days !== null
                ? days >= 0
                  ? html`<p class="hint">
                      That's ${days} ${days === 1 ? 'day' : 'days'} from today.
                    </p>`
                  : html`<p class="hint">That date is in the past.</p>`
                : html`<p class="hint">A deadline is required before you can lock this goal in.</p>`}
            `
          : nothing}
        <div class="actions">
          ${this.step > 0
            ? html`<ion-button fill="clear" @click=${this.prevStep}>Back</ion-button>`
            : html`<ion-button fill="clear" @click=${this.back}>Cancel</ion-button>`}
          ${last
            ? html`<ion-button ?disabled=${this.busy || this.form.title.trim() === ''} @click=${this.onSave}>
                Create draft
              </ion-button>`
            : html`<ion-button ?disabled=${!this.canAdvance} @click=${this.nextStep}>Next</ion-button>`}
        </div>
        <p class="hint">Drafts stay fully editable. Locking in is the permanent part.</p>
      </div>
    `;
  }

  private renderEditForm(): TemplateResult {
    return html`
      <div class="goal-form">
        ${this.textField('title', 'Goal title', 'What are you committing to?')}
        ${this.textField('reasons', 'Why does this matter?', 'Optional.', 3)}
        ${this.textField('specifics', 'What does done look like?', 'Be specific.', 3)}
        ${this.textField('measure', 'How will you measure it?', 'Optional.', 2)}
        <label>
          Deadline
          <input type="date" .value=${this.form.deadline} @input=${this.fieldInput('deadline')} />
        </label>
        <div class="actions">
          <ion-button fill="clear" @click=${this.back}>Cancel</ion-button>
          <ion-button ?disabled=${this.busy || this.form.title.trim() === ''} @click=${this.onSave}>
            Save draft
          </ion-button>
        </div>
        <p class="hint">A goal stays fully editable until you lock it in.</p>
      </div>
    `;
  }

  private renderDetail(goal: Goal): TemplateResult {
    const left = isTerminal(goal) ? null : timeLeft(goal, todayISO());
    const progress = this.renderProgress(goal);
    const focusTask =
      goal.activeTaskId !== null
        ? this.tasks.find((task) => task.id === goal.activeTaskId)
        : undefined;
    return html`
      <div class="detail">
        <div class="detail-head">
          <h1>${goal.title}</h1>
          <ion-badge color=${STATUS_COLOR[goal.status]}>${STATUS_LABEL[goal.status]}</ion-badge>
        </div>
        ${goal.reasons
          ? html`<section>
              <h2>Why this matters</h2>
              <blockquote>${goal.reasons}</blockquote>
            </section>`
          : nothing}
        ${goal.specifics
          ? html`<section><h2>What done looks like</h2><p>${goal.specifics}</p></section>`
          : nothing}
        ${goal.measure
          ? html`<section><h2>How it's measured</h2><p>${goal.measure}</p></section>`
          : nothing}
        ${goal.deadline !== null
          ? html`<section>
              <h2>Deadline</h2>
              <p>
                ${goal.deadline}${left !== null
                  ? left.overdue
                    ? ` — ${left.days} days overdue`
                    : ` — ${left.days} days left`
                  : nothing}
              </p>
            </section>`
          : nothing}
        ${progress}
        ${focusTask
          ? html`<section><h2>Current focus</h2><p>★ ${focusTask.title}</p></section>`
          : nothing}
        ${goal.status === 'locked' ? this.renderQuote(goal.id) : nothing}
        ${goal.lockedAt !== null
          ? html`<section>
              <h2>Locked</h2>
              <p>${new Date(goal.lockedAt).toLocaleString()}</p>
            </section>`
          : nothing}
        ${this.renderDetailActions(goal)}
      </div>
    `;
  }

  private renderQuote(seed: string): TemplateResult {
    const quote = quoteFor(seed);
    return html`
      <blockquote class="quote">“${quote.text}” <cite>— ${quote.author}</cite></blockquote>
    `;
  }

  private renderProgress(goal: Goal): TemplateResult | typeof nothing {    const tasks = this.tasks.filter((task) => task.goalId === goal.id);
    if (tasks.length === 0) return nothing;
    const start = isoDateOf(goal.lockedAt ?? goal.createdAt);
    const progress = goalProgress(tasks, this.occurrences, { start, end: todayISO() }, goal.deadline);
    if (progress.total === 0) return nothing;
    return html`
      <section>
        <h2>Progress</h2>
        <ion-progress-bar value=${progress.ratio ?? 0}></ion-progress-bar>
        <p>${progress.done} of ${progress.total} due occurrences done</p>
      </section>
    `;
  }

  private renderDetailActions(goal: Goal): TemplateResult {
    if (isEditable(goal)) {
      return html`
        <div class="actions">
          <ion-button fill="outline" @click=${() => this.startEdit(goal)}>
            <ion-icon slot="start" name="create-outline"></ion-icon>Edit
          </ion-button>
          <ion-button ?disabled=${!canLock(goal)} @click=${() => this.lock(goal)}>
            <ion-icon slot="start" name="lock-closed-outline"></ion-icon>Lock in
          </ion-button>
          <ion-button color="danger" fill="clear" @click=${() => this.removeDraft(goal)}>
            <ion-icon slot="start" name="trash-outline"></ion-icon>Delete draft
          </ion-button>
        </div>
        ${canLock(goal)
          ? nothing
          : html`<p class="hint">Set a deadline before you can lock this goal in.</p>`}
      `;
    }

    if (goal.status === 'locked') {
      return html`
        <div class="actions">
          <ion-button color="success" @click=${() => this.startClose(goal, 'completed')}>
            <ion-icon slot="start" name="checkmark-circle-outline"></ion-icon>Completed
          </ion-button>
          <ion-button color="danger" @click=${() => this.startClose(goal, 'failed')}>
            <ion-icon slot="start" name="close-circle-outline"></ion-icon>Failed
          </ion-button>
          <ion-button color="warning" @click=${() => this.startClose(goal, 'abandoned')}>
            <ion-icon slot="start" name="ban-outline"></ion-icon>Abandoned
          </ion-button>
        </div>
        <p class="hint">These are permanent — closing a goal ends it for good.</p>
      `;
    }

    return isTerminal(goal)
      ? html`
          <div class="actions">
            <ion-button fill="outline" @click=${() => this.restart(goal)}>
              <ion-icon slot="start" name="refresh-outline"></ion-icon>Restart as new goal
            </ion-button>
          </div>
          <p class="hint">This goal is closed. Its history is permanent.</p>
        `
      : html``;
  }

  private renderClose(goal: Goal, status: TerminalStatus): TemplateResult {
    const label = STATUS_LABEL[status].toLowerCase();
    return html`
      <div class="close">
        <h2>Close this goal as ${label}?</h2>
        <p class="hint">
          This is permanent. A closed goal can never be changed or reopened.
        </p>
        <section>
          <h2>How did you do?</h2>
          <div class="actions">
            <ion-button
              color="success"
              fill=${this.outcome.rating === 'good' ? 'solid' : 'outline'}
              @click=${() => this.setRating('good')}
            >
              Good
            </ion-button>
            <ion-button
              color="danger"
              fill=${this.outcome.rating === 'bad' ? 'solid' : 'outline'}
              @click=${() => this.setRating('bad')}
            >
              Bad
            </ion-button>
          </div>
        </section>
        <label>
          Reflect — what did you learn?
          <textarea
            rows="4"
            .value=${this.outcome.reflection}
            placeholder="Optional. A note to future you, stored forever."
            @input=${(event: Event) =>
              this.setReflection((event.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
        <div class="actions">
          <ion-button fill="clear" @click=${this.back}>Cancel</ion-button>
          <ion-button
            color=${STATUS_COLOR[status]}
            ?disabled=${this.busy}
            @click=${() => this.submitClose(goal, status)}
          >
            Mark ${label}
          </ion-button>
        </div>
      </div>
    `;
  }
}
