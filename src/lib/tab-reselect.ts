/**
 * Wires the "tap the active tab again to pop back to root" listener the shell
 * dispatches. Returns the cleanup to call from `disconnectedCallback`.
 */
export function setupTabReselect(host: HTMLElement, handler: () => void): () => void {
  host.addEventListener('tab-reselect', handler);
  return () => host.removeEventListener('tab-reselect', handler);
}