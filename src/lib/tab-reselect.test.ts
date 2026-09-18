// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { setupTabReselect } from './tab-reselect.js';

describe('setupTabReselect', () => {
  it('calls the handler when a tab-reselect event fires on the host', () => {
    const host = document.createElement('div');
    const handler = vi.fn();
    setupTabReselect(host, handler);

    host.dispatchEvent(new CustomEvent('tab-reselect', { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not react to unrelated events', () => {
    const host = document.createElement('div');
    const handler = vi.fn();
    setupTabReselect(host, handler);

    host.dispatchEvent(new CustomEvent('click'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('returns a cleanup that removes the listener', () => {
    const host = document.createElement('div');
    const handler = vi.fn();
    const cleanup = setupTabReselect(host, handler);

    cleanup();
    host.dispatchEvent(new CustomEvent('tab-reselect', { bubbles: true, composed: true }));

    expect(handler).not.toHaveBeenCalled();
  });
});