import { describe, expect, it } from 'vitest';
import type { ListItem, Note } from '../db/types.js';
import { moveListItem, noteStats, promoteItem } from './list.js';

function item(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'i1',
    text: 'item',
    checked: false,
    status: 'idle',
    promotedTo: null,
    order: 0,
    ...overrides,
  };
}

function note(items: ListItem[]): Note {
  return { id: 'n1', title: 'List', body: '', items, createdAt: '2026-09-15T00:00:00.000Z' };
}

describe('noteStats', () => {
  it('counts total, checked, and promoted items', () => {
    const stats = noteStats(
      note([
        item({ id: 'a', checked: true }),
        item({ id: 'b', checked: true, status: 'promoted', promotedTo: { type: 'task', id: 't' } }),
        item({ id: 'c' }),
      ]),
    );
    expect(stats).toEqual({ total: 3, checked: 2, promoted: 1 });
  });

  it('handles an empty list', () => {
    expect(noteStats(note([]))).toEqual({ total: 0, checked: 0, promoted: 0 });
  });
});

describe('moveListItem', () => {
  const items = [
    item({ id: 'a', order: 0 }),
    item({ id: 'b', order: 1 }),
    item({ id: 'c', order: 2 }),
  ];

  it('moves an item down and renumbers', () => {
    expect(moveListItem(items, 'a', 1).map((entry) => [entry.id, entry.order])).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
  });

  it('moves an item up', () => {
    expect(moveListItem(items, 'c', -1).map((entry) => entry.id)).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op past the ends', () => {
    expect(moveListItem(items, 'a', -1)).toBe(items);
    expect(moveListItem(items, 'c', 1)).toBe(items);
  });

  it('is a no-op for an unknown id', () => {
    expect(moveListItem(items, 'zzz', 1)).toBe(items);
  });

  it('sorts by order before moving', () => {
    const shuffled = [items[2], items[0], items[1]];
    expect(moveListItem(shuffled, 'a', 1).map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('promoteItem', () => {
  it('sets promoted status and the pointer without mutating the source', () => {
    const source = item();
    const result = promoteItem(source, { type: 'goal', id: 'g1' });
    expect(result).toMatchObject({
      status: 'promoted',
      promotedTo: { type: 'goal', id: 'g1' },
    });
    expect(source.status).toBe('idle');
    expect(source.promotedTo).toBeNull();
  });
});
