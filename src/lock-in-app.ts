import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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

  @state() private activeTab: TabName = 'goals';
  private rolloverStarted = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.rolloverStarted) {
      this.rolloverStarted = true;
      runMissedRollover().catch((error: unknown) => {
        console.error('Missed rollover failed', error);
      });
    }
    this.addEventListener('ionTabButtonClick', this.onTabClick);
    this.addEventListener('ionTabsDidChange', this.onTabChange);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('ionTabButtonClick', this.onTabClick);
    this.removeEventListener('ionTabsDidChange', this.onTabChange);
  }

  private onTabChange = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (detail?.tab !== undefined && TABS.includes(detail.tab)) {
      this.activeTab = detail.tab;
    }
  };

  private onTabClick = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    const clickedTab = detail?.tab as TabName | undefined;
    if (clickedTab === undefined) return;
    // If the user tapped the already-active tab, pop that view to root
    if (clickedTab === this.activeTab) {
      // Views listen on themselves, but DOM events only travel upward — dispatching
      // on the <ion-tab> parent would never reach them. Target the view element.
      this.shadowRoot
        ?.querySelector(`[tab="${clickedTab}"]`)
        ?.firstElementChild?.dispatchEvent(
          new CustomEvent('tab-reselect', { bubbles: true, composed: true }),
        );
    }
  };

  protected async firstUpdated(): Promise<void> {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested === null || !TABS.includes(requested as TabName)) return;
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
