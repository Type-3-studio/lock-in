// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import './countdown-timer.js';
import { countdownTo } from '../lib/countdown.js';

interface CountdownTimerElement extends HTMLElement {
  deadline: string;
  overdue: boolean;
  updateComplete: Promise<unknown>;
}

interface Unit {
  num: string;
  label: string;
}

function units(el: CountdownTimerElement): Unit[] {
  const blocks = el.shadowRoot?.querySelectorAll('.unit') ?? [];
  return [...blocks].map((block) => ({
    num: block.querySelector('.num')?.textContent?.trim() ?? '',
    label: block.querySelector('.lbl')?.textContent?.trim() ?? '',
  }));
}

function numAt(el: CountdownTimerElement, index: number): string {
  return units(el)[index]?.num ?? '';
}

async function render(): Promise<CountdownTimerElement> {
  const el = document.createElement('countdown-timer') as CountdownTimerElement;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function setDeadline(el: CountdownTimerElement, deadline: string): Promise<void> {
  el.deadline = deadline;
  vi.advanceTimersByTime(0);
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('countdown-timer', () => {
  it('registers the custom element', () => {
    expect(customElements.get('countdown-timer')).toBeDefined();
  });

  it('renders four labelled zeroes without a deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T20:00:00'));
    const el = await render();

    expect(units(el).map((u) => u.label)).toEqual(['Day', 'Hrs', 'Min', 'Sec']);
    expect(units(el).map((u) => u.num)).toEqual(['00', '00', '00', '00']);
    expect(el.shadowRoot?.querySelector('[role="timer"]')?.getAttribute('aria-label')).toBe(
      '0 days, 0 hours and 0 minutes remaining',
    );
  });

  it('renders units matching the pure countdown math', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T20:00:00'));
    const el = await render();
    await setDeadline(el, '2026-09-25');

    const expected = countdownTo('2026-09-25', Date.now());
    const rendered = units(el);

    expect(rendered.map((u) => u.label)).toEqual(['Day', 'Hrs', 'Min', 'Sec']);
    expect(Number(numAt(el, 0))).toBe(expected.days);
    expect(Number(numAt(el, 1))).toBe(expected.hours);
    expect(Number(numAt(el, 2))).toBe(expected.minutes);
    expect(Number(numAt(el, 3))).toBe(expected.seconds);
  });

  it('ticks forward each second', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T20:00:00'));
    const el = await render();
    await setDeadline(el, '2026-09-25');

    const start = Number(numAt(el, 3));

    vi.advanceTimersByTime(1000);
    await el.updateComplete;

    expect(Number(numAt(el, 3))).toBe(start === 0 ? 59 : start - 1);
  });

  it('flags an overdue timer with the overdue class and label', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T20:00:00'));
    const el = await render();
    el.overdue = true;
    await setDeadline(el, '2026-09-18');

    expect(el.shadowRoot?.querySelector('.countdown')?.classList.contains('overdue')).toBe(true);
    expect(el.shadowRoot?.querySelector('[role="timer"]')?.getAttribute('aria-label')).toBe(
      'Deadline passed (2026-09-18)',
    );
  });

  it('clears the interval when disconnected', async () => {
    vi.useFakeTimers();
    const el = await render();
    const clearSpy = vi.spyOn(window, 'clearInterval');

    el.remove();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    clearSpy.mockRestore();
  });
});
