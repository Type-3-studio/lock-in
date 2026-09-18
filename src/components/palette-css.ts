import { css } from 'lit';

/**
 * Ionic ships its `.ion-color-*` palette mapping in the *document*-scoped
 * `ionic.bundle.css`. The app renders Ionic components inside Lit shadow
 * roots, so those rules never match the components and every
 * `color="success|danger|warning|medium|…"` button/badge silently fell back to
 * the default palette (dark text / wrong backgrounds in dark mode).
 *
 * Inclusion inside a shadow root makes the mapping reach the component hosts.
 * The underlying values still come from the app's own theme variables (see
 * `src/index.css` `:root` / `.dark`), so light/dark switching keeps working.
 *
 * Add this to a Lit element's `static styles`: `[css`...`, PALETTE_CSS]`.
 */
export const PALETTE_CSS = css`
  .ion-color-primary {
    --ion-color-base: var(--ion-color-primary);
    --ion-color-base-rgb: var(--ion-color-primary-rgb);
    --ion-color-contrast: var(--ion-color-primary-contrast);
    --ion-color-contrast-rgb: var(--ion-color-primary-contrast-rgb);
    --ion-color-shade: var(--ion-color-primary-shade);
    --ion-color-tint: var(--ion-color-primary-tint);
  }

  .ion-color-secondary {
    --ion-color-base: var(--ion-color-secondary);
    --ion-color-base-rgb: var(--ion-color-secondary-rgb);
    --ion-color-contrast: var(--ion-color-secondary-contrast);
    --ion-color-contrast-rgb: var(--ion-color-secondary-contrast-rgb);
    --ion-color-shade: var(--ion-color-secondary-shade);
    --ion-color-tint: var(--ion-color-secondary-tint);
  }

  .ion-color-success {
    --ion-color-base: var(--ion-color-success);
    --ion-color-base-rgb: var(--ion-color-success-rgb);
    --ion-color-contrast: var(--ion-color-success-contrast);
    --ion-color-contrast-rgb: var(--ion-color-success-contrast-rgb);
    --ion-color-shade: var(--ion-color-success-shade);
    --ion-color-tint: var(--ion-color-success-tint);
  }

  .ion-color-warning {
    --ion-color-base: var(--ion-color-warning);
    --ion-color-base-rgb: var(--ion-color-warning-rgb);
    --ion-color-contrast: var(--ion-color-warning-contrast);
    --ion-color-contrast-rgb: var(--ion-color-warning-contrast-rgb);
    --ion-color-shade: var(--ion-color-warning-shade);
    --ion-color-tint: var(--ion-color-warning-tint);
  }

  .ion-color-danger {
    --ion-color-base: var(--ion-color-danger);
    --ion-color-base-rgb: var(--ion-color-danger-rgb);
    --ion-color-contrast: var(--ion-color-danger-contrast);
    --ion-color-contrast-rgb: var(--ion-color-danger-contrast-rgb);
    --ion-color-shade: var(--ion-color-danger-shade);
    --ion-color-tint: var(--ion-color-danger-tint);
  }

  .ion-color-medium {
    --ion-color-base: var(--ion-color-medium);
    --ion-color-base-rgb: var(--ion-color-medium-rgb);
    --ion-color-contrast: var(--ion-color-medium-contrast);
    --ion-color-contrast-rgb: var(--ion-color-medium-contrast-rgb);
    --ion-color-shade: var(--ion-color-medium-shade);
    --ion-color-tint: var(--ion-color-medium-tint);
  }

  /* Outline buttons must stay visible against the current surface. */
  ion-button[fill='outline'] {
    --border-color: var(--ion-color-step-300, currentColor);
  }
`;