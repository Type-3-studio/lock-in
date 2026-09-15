import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './views/goals-view.js';
import './views/weeks-view.js';
import './views/lists-view.js';
import './views/history-view.js';
import { runMissedRollover } from './db/rollover.js';

const TABS = ['goals', 'weeks', 'lists', 'history'] as const;

type TabName = (typeof TABS)[number];

@customElement('lock-in-app')
export class LockInApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  private rolloverStarted = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.rolloverStarted) {
      this.rolloverStarted = true;
      runMissedRollover().catch((error: unknown) => {
        console.error('Missed rollover failed', error);
      });
    }
  }

  protected async firstUpdated(): Promise<void> {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested === null || !TABS.includes(requested as TabName)) return;
    // The Ionic custom elements may not be upgraded yet when Lit first renders,
    // so wait until `ion-tabs` is defined before selecting the requested tab.
    await customElements.whenDefined('ion-tabs');
    const tabs = this.renderRoot.querySelector('ion-tabs') as
      | (Element & { select?: (tab: string) => Promise<boolean> })
      | null;
    if (tabs?.select !== undefined) void tabs.select(requested);
  }

  render() {
    return html`
      <ion-app>
        <ion-tabs>
          <ion-tab tab="goals"><goals-view></goals-view></ion-tab>
          <ion-tab tab="weeks"><weeks-view></weeks-view></ion-tab>
          <ion-tab tab="lists"><lists-view></lists-view></ion-tab>
          <ion-tab tab="history"><history-view></history-view></ion-tab>
          <ion-tab-bar slot="bottom">
            <ion-tab-button tab="goals">
              <ion-icon name="flag-outline"></ion-icon>
              <ion-label>Goals</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="weeks">
              <ion-icon name="calendar-outline"></ion-icon>
              <ion-label>Weeks</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="lists">
              <ion-icon name="list-outline"></ion-icon>
              <ion-label>Lists</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="history">
              <ion-icon name="time-outline"></ion-icon>
              <ion-label>History</ion-label>
            </ion-tab-button>
          </ion-tab-bar>
        </ion-tabs>
      </ion-app>
    `;
  }
}
