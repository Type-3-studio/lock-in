import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ListItem, Note } from '../db/types.js';
import {
  addNoteItem,
  createGoal,
  createNote,
  createTask,
  deleteNote,
  liveNotes,
  moveNoteItem,
  promoteNoteItem,
  removeNoteItem,
  setNoteItemChecked,
  updateNote,
  updateNoteItem,
} from '../db/store.js';
import { todayISO } from '../lib/clock.js';
import { confirmAction } from '../lib/confirm.js';
import { noteStats } from '../lib/list.js';

type Screen = { kind: 'list' } | { kind: 'note'; id: string };

@customElement('lists-view')
export class ListsView extends LitElement {
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

    .note {
      display: grid;
      gap: 14px;
      max-width: 720px;
    }

    .note-title,
    .note-body,
    .add-row input {
      font: inherit;
      font-weight: 400;
      padding: 10px 12px;
      border: 1px solid var(--ion-color-step-200, #d4d4d8);
      border-radius: 8px;
      background: var(--ion-background-color, #fff);
      color: var(--ion-text-color, #111);
      width: 100%;
    }

    .note-title {
      font-weight: 700;
      font-size: 1.1rem;
    }

    .note-body {
      resize: vertical;
    }

    .stats {
      font-size: 0.85rem;
      color: var(--ion-color-medium);
    }

    ul.items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }

    ul.items li {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border: 1px solid var(--ion-color-step-150, #e5e5e5);
      border-radius: 8px;
    }

    ul.items li.promoted {
      opacity: 0.75;
      background: var(--ion-color-step-50, #f7f7f8);
    }

    .item-text {
      flex: 1;
      min-width: 0;
      font: inherit;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 2px 0;
    }

    .item-text:focus {
      outline: 1px solid var(--ion-color-primary);
      border-radius: 4px;
    }

    ul.items li.checked .item-text {
      text-decoration: line-through;
      color: var(--ion-color-medium);
    }

    .badge {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border-radius: 999px;
      background: var(--ion-color-step-100, #ececec);
      color: var(--ion-color-medium);
      white-space: nowrap;
    }

    .icon-btn {
      flex: none;
      min-width: 26px;
      height: 26px;
      padding: 0 6px;
      border: 1px solid var(--ion-color-step-200, #d4d4d8);
      border-radius: 6px;
      background: transparent;
      color: var(--ion-color-medium);
      font-size: 0.75rem;
      cursor: pointer;
    }

    .icon-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .add-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  `;

  @state() private notes: Note[] = [];
  @state() private screen: Screen = { kind: 'list' };
  @state() private newItemText = '';
  @state() private busy = false;

  private subscription?: { unsubscribe(): void };

  connectedCallback(): void {
    super.connectedCallback();
    this.subscription = liveNotes().subscribe((notes) => {
      this.notes = notes;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscription?.unsubscribe();
  }

  private get activeNote(): Note | undefined {
    const screen = this.screen;
    if (screen.kind !== 'note') return undefined;
    return this.notes.find((note) => note.id === screen.id);
  }

  private items(note: Note): ListItem[] {
    return [...note.items].sort((a, b) => a.order - b.order);
  }

  private open(id: string): void {
    this.screen = { kind: 'note', id };
  }

  private back = (): void => {
    this.screen = { kind: 'list' };
  };

  private async createList(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const note = await createNote({ title: 'New list' });
      this.screen = { kind: 'note', id: note.id };
    } finally {
      this.busy = false;
    }
  }

  private async removeNote(note: Note): Promise<void> {
    const confirmed = await confirmAction({
      header: 'Delete this list?',
      message: 'Notes are v1 scratch space; deleting cannot be undone.',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    await deleteNote(note.id);
    this.screen = { kind: 'list' };
  }

  private async addItem(note: Note): Promise<void> {
    const text = this.newItemText.trim();
    if (text === '') return;
    this.newItemText = '';
    await addNoteItem(note.id, text);
  }

  private renameItem(note: Note, item: ListItem, text: string): void {
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === item.text) return;
    void updateNoteItem(note.id, item.id, { text: trimmed });
  }

  private async promoteToTask(note: Note, item: ListItem): Promise<void> {
    const task = await createTask({ title: item.text, anchorDate: todayISO() });
    await promoteNoteItem(note.id, item.id, { type: 'task', id: task.id });
  }

  private async promoteToGoal(note: Note, item: ListItem): Promise<void> {
    const goal = await createGoal({ title: item.text });
    await promoteNoteItem(note.id, item.id, { type: 'goal', id: goal.id });
  }

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar>
          ${this.screen.kind === 'note'
            ? html`<ion-buttons slot="start">
                <ion-button aria-label="Back" @click=${this.back}>
                  <ion-icon slot="icon-only" name="arrow-back-outline"></ion-icon>
                </ion-button>
              </ion-buttons>`
            : nothing}
          <ion-title>${this.screen.kind === 'note' ? 'List' : 'Lists'}</ion-title>
          ${this.screen.kind === 'list'
            ? html`<ion-buttons slot="end">
                <ion-button aria-label="New list" @click=${() => this.createList()}>
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
    const note = this.activeNote;
    if (this.screen.kind === 'note' && note !== undefined) return this.renderNote(note);
    return this.renderList();
  }

  private renderList(): TemplateResult {
    if (this.notes.length === 0) {
      return html`
        <div class="empty">
          <ion-icon name="list-outline"></ion-icon>
          <p>No lists yet. Capture ideas, then promote the good ones into tasks or goals.</p>
          <ion-button @click=${() => this.createList()}>Create a list</ion-button>
        </div>
      `;
    }
    return html`
      <ion-list>
        ${this.notes.map((note) => {
          const stats = noteStats(note);
          return html`
            <ion-item button @click=${() => this.open(note.id)}>
              <ion-label class="ion-text-wrap">
                <h2>${note.title || 'Untitled list'}</h2>
                <p>${stats.total} items · ${stats.checked} checked · ${stats.promoted} promoted</p>
              </ion-label>
            </ion-item>
          `;
        })}
      </ion-list>
    `;
  }

  private renderNote(note: Note): TemplateResult {
    const stats = noteStats(note);
    const items = this.items(note);
    return html`
      <div class="note">
        <input
          class="note-title"
          .value=${note.title}
          placeholder="List name"
          @change=${(event: Event) =>
            updateNote(note.id, { title: (event.target as HTMLInputElement).value.trim() })}
        />
        <textarea
          class="note-body"
          rows="3"
          placeholder="Notes (optional)"
          .value=${note.body}
          @change=${(event: Event) =>
            updateNote(note.id, { body: (event.target as HTMLTextAreaElement).value })}
        ></textarea>
        <p class="stats">${stats.checked} of ${stats.total} checked · ${stats.promoted} promoted</p>
        <ul class="items">
          ${items.map((item, index) => this.renderItem(note, item, index, items.length))}
        </ul>
        <div class="add-row">
          <input
            .value=${this.newItemText}
            placeholder="Add item"
            @input=${(event: Event) => {
              this.newItemText = (event.target as HTMLInputElement).value;
            }}
            @keydown=${(event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void this.addItem(note);
              }
            }}
          />
          <ion-button @click=${() => this.addItem(note)}>Add</ion-button>
        </div>
        <div class="actions">
          <ion-button color="danger" fill="clear" @click=${() => this.removeNote(note)}>
            <ion-icon slot="start" name="trash-outline"></ion-icon>Delete list
          </ion-button>
        </div>
      </div>
    `;
  }

  private renderItem(
    note: Note,
    item: ListItem,
    index: number,
    total: number,
  ): TemplateResult {
    const promoted = item.status === 'promoted' && item.promotedTo !== null;
    return html`
      <li class=${`${item.checked ? 'checked' : ''} ${promoted ? 'promoted' : ''}`.trim()}>
        <input
          type="checkbox"
          aria-label="Checked"
          .checked=${item.checked}
          @change=${(event: Event) =>
            setNoteItemChecked(note.id, item.id, (event.target as HTMLInputElement).checked)}
        />
        <input
          class="item-text"
          .value=${item.text}
          @change=${(event: Event) =>
            this.renameItem(note, item, (event.target as HTMLInputElement).value)}
        />
        ${promoted
          ? html`<span class="badge">${item.promotedTo?.type}</span>`
          : html`
              <button
                class="icon-btn"
                title="Move up"
                ?disabled=${index === 0}
                @click=${() => moveNoteItem(note.id, item.id, -1)}
              >
                ↑
              </button>
              <button
                class="icon-btn"
                title="Move down"
                ?disabled=${index === total - 1}
                @click=${() => moveNoteItem(note.id, item.id, 1)}
              >
                ↓
              </button>
              <button class="icon-btn" @click=${() => this.promoteToTask(note, item)}>
                Task
              </button>
              <button class="icon-btn" @click=${() => this.promoteToGoal(note, item)}>
                Goal
              </button>
            `}
        <button class="icon-btn" title="Remove" @click=${() => removeNoteItem(note.id, item.id)}>
          ×
        </button>
      </li>
    `;
  }
}
