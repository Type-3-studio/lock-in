import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { HistoryEntry, HistoryType, Settings } from '../db/types.js';
import {
  exportData,
  importData,
  liveBackups,
  liveHistory,
  liveSettings,
  restoreBackup,
  updateSettings,
} from '../db/store.js';
import type { Backup } from '../db/db.js';
import { parseExportJson } from '../lib/dto.js';
import { historyStats } from '../lib/stats.js';
import { todayISO } from '../lib/clock.js';
import { confirmAction, showAlert } from '../lib/confirm.js';
import { timestampLabel } from '../lib/format.js';
import {
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemeMode,
} from '../lib/theme.js';

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const TYPE_LABEL: Record<HistoryType, string> = {
  goal_locked: 'Locked',
  goal_completed: 'Completed',
  goal_failed: 'Failed',
  goal_abandoned: 'Abandoned',
  task_done: 'Task done',
  task_missed: 'Task missed',
  week_note_added: 'Note',
};

const TYPE_COLOR: Record<HistoryType, string> = {
  goal_locked: 'primary',
  goal_completed: 'success',
  goal_failed: 'danger',
  goal_abandoned: 'warning',
  task_done: 'success',
  task_missed: 'danger',
  week_note_added: 'medium',
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

@customElement('history-view')
export class HistoryView extends LitElement {
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

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }

    .stat {
      padding: 10px 12px;
      border: 1px solid var(--ion-color-step-150, #e5e5e5);
      border-radius: 10px;
    }

    .stat .value {
      font-size: 1.4rem;
      font-weight: 700;
    }

    .stat .label {
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }

    h2 {
      margin: 20px 0 8px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ion-color-medium);
    }

    .entry {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid var(--ion-color-step-100, #ededed);
    }

    .entry .body {
      flex: 1;
      min-width: 0;
    }

    .entry .when {
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }

    .empty {
      padding: 32px 0;
      text-align: center;
      color: var(--ion-color-medium);
    }

    .settings {
      display: grid;
      gap: 10px;
    }

    .settings .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .settings .hint,
    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--ion-color-medium);
    }

    .file-input {
      display: none;
    }

    .backup {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.85rem;
      padding: 6px 0;
    }

    .time-label {
      display: grid;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--ion-color-medium);
    }

    .time-label input {
      font: inherit;
      font-weight: 400;
      padding: 6px 10px;
      border: 1px solid var(--ion-color-step-200);
      border-radius: 8px;
      background: var(--ion-background-color);
      color: var(--ion-text-color);
    }
  `;

  @state() private entries: HistoryEntry[] = [];
  @state() private backups: Backup[] = [];
  @state() private theme: ThemeMode = loadTheme();
  @state() private busy = false;
  @state() private settings: Settings = { id: 'default', wakeTime: '07:00', bedTime: '23:00', showDeadlineLine: true };

  private subscriptions: Array<{ unsubscribe(): void }> = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.subscriptions = [
      liveHistory().subscribe((entries) => {
        this.entries = entries;
      }),
      liveBackups().subscribe((backups) => {
        this.backups = backups;
      }),
      liveSettings().subscribe((settings) => {
        this.settings = settings;
      }),
    ];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }

  private describe(entry: HistoryEntry): { title: string; detail: string } {
    const snapshot = record(entry.snapshot);
    const title = text(snapshot?.title) || 'Untitled';
    switch (entry.type) {
      case 'goal_locked':
        return { title: `Locked “${title}”`, detail: '' };
      case 'goal_completed':
      case 'goal_failed':
      case 'goal_abandoned': {
        const outcome = record(snapshot?.outcome);
        const rating = text(outcome?.rating);
        const reflection = text(outcome?.reflection);
        const detail = [rating ? `rated ${rating}` : '', reflection].filter(Boolean).join(' · ');
        return { title: `“${title}” ${TYPE_LABEL[entry.type].toLowerCase()}`, detail };
      }
      case 'task_done':
      case 'task_missed':
        return {
          title: `${TYPE_LABEL[entry.type]}: ${title}`,
          detail: text(snapshot?.date),
        };
      case 'week_note_added':
        return { title: `Note “${title}”`, detail: '' };
      default:
        return { title, detail: '' };
    }
  }

  private async exportJson(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const dto = await exportData();
      const blob = new Blob([JSON.stringify(dto, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lock-in-export-${todayISO()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.busy = false;
    }
  }

  private onImportFile = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined || this.busy) return;

    let dto;
    try {
      dto = parseExportJson(await file.text());
    } catch (error) {
      await showAlert('Import failed', error instanceof Error ? error.message : 'Unknown error.');
      return;
    }

    const confirmed = await confirmAction({
      header: 'Replace all data with this file?',
      message: 'Import is replace-only. Your current data is backed up automatically first.',
      confirmText: 'Import',
    });
    if (!confirmed) return;

    this.busy = true;
    try {
      await importData(dto);
    } finally {
      this.busy = false;
    }
  };

  private async restore(backup: Backup): Promise<void> {
    const confirmed = await confirmAction({
      header: 'Restore this backup?',
      message: `Current data will be replaced with the snapshot from ${timestampLabel(backup.createdAt)}.`,
      confirmText: 'Restore',
    });
    if (!confirmed) return;
    await restoreBackup(backup.id);
  }

  private openFilePicker(): void {
    this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  }

  private setTheme(mode: ThemeMode): void {
    this.theme = mode;
    saveTheme(mode);
    applyTheme(mode);
  }

  private async onTimeChange(field: 'wakeTime' | 'bedTime', value: string): Promise<void> {
    await updateSettings({ [field]: value });
  }

  private async onDeadlineLineToggle(checked: boolean): Promise<void> {
    await updateSettings({ showDeadlineLine: checked });
  }

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar>
          <ion-title>History</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="stats">
          ${this.stat('Completed', String(this.stats.completed))}
          ${this.stat('Failed', String(this.stats.failed))}
          ${this.stat('Abandoned', String(this.stats.abandoned))}
          ${this.stat(
            'Avg days to finish',
            this.stats.averageDaysToComplete === null
              ? '—'
              : this.stats.averageDaysToComplete.toFixed(1),
          )}
          ${this.stat('Tasks done', String(this.stats.tasksDone))}
          ${this.stat('Tasks missed', String(this.stats.tasksMissed))}
        </div>

        <h2>Audit log</h2>
        ${this.entries.length === 0
          ? html`<p class="empty">Nothing logged yet.</p>`
          : this.entries.map((entry) => this.renderEntry(entry))}

        <h2>Settings</h2>
        <div class="settings">
          <p class="hint">
            Everything is local. Export a versioned JSON file, or replace all data by importing one.
          </p>

          <h2>Appearance</h2>
          <div class="row">
            <ion-segment
              .value=${this.theme}
              @ionChange=${(e: Event) => this.setTheme((e.target as HTMLIonSegmentElement).value as ThemeMode)}
            >
              ${THEME_OPTIONS.map(
                (option) => html`
                  <ion-segment-button value=${option.id}>
                    <ion-label>${option.label}</ion-label>
                  </ion-segment-button>
                `,
              )}
            </ion-segment>
          </div>
          <p class="hint">Violet is the app's accent. Light, dark, or follow the system.</p>

          <h2>Schedule</h2>
          <div class="row">
            <label class="time-label">
              Wake time
              <input
                type="time"
                .value=${this.settings.wakeTime}
                @change=${(e: Event) => this.onTimeChange('wakeTime', (e.target as HTMLInputElement).value)}
              />
            </label>
            <label class="time-label">
              Bed time
              <input
                type="time"
                .value=${this.settings.bedTime}
                @change=${(e: Event) => this.onTimeChange('bedTime', (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
          <div class="row">
            <ion-toggle
              .checked=${this.settings.showDeadlineLine}
              @ionChange=${(e: Event) => this.onDeadlineLineToggle((e.target as HTMLIonToggleElement).checked)}
            >
              Show deadline line on calendar
            </ion-toggle>
          </div>

          <div class="row">
            <ion-button ?disabled=${this.busy} @click=${() => this.exportJson()}>
              Export JSON
            </ion-button>
            <ion-button ?disabled=${this.busy} @click=${this.openFilePicker}>
              Import JSON
            </ion-button>
            <input
              class="file-input"
              type="file"
              accept="application/json,.json"
              @change=${this.onImportFile}
            />
          </div>

          <h2>Auto-backups</h2>
          ${this.backups.length === 0
            ? html`<p class="hint">A backup is saved automatically before every import.</p>`
            : this.backups.map(
                (backup) => html`
                  <div class="backup">
                    <span>
                      ${timestampLabel(backup.createdAt)} · ${backup.data.goals.length} goals ·
                      ${backup.data.tasks.length} tasks
                    </span>
                    <ion-button size="small" fill="clear" @click=${() => this.restore(backup)}>
                      Restore
                    </ion-button>
                  </div>
                `,
              )}
        </div>
      </ion-content>
    `;
  }

  private get stats() {
    return historyStats(this.entries);
  }

  private stat(label: string, value: string): TemplateResult {
    return html`<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`;
  }

  private renderEntry(entry: HistoryEntry): TemplateResult {
    const { title, detail } = this.describe(entry);
    return html`
      <div class="entry">
        <ion-badge color=${TYPE_COLOR[entry.type]}>${TYPE_LABEL[entry.type]}</ion-badge>
        <div class="body">
          <div>${title}</div>
          ${detail ? html`<div class="when">${detail}</div>` : nothing}
          <div class="when">${timestampLabel(entry.timestamp)}</div>
        </div>
      </div>
    `;
  }
}
