import type { ListItem, Note } from '../db/types.js';

export interface NoteStats {
  total: number;
  checked: number;
  promoted: number;
}

export function noteStats(note: Note): NoteStats {
  return {
    total: note.items.length,
    checked: note.items.filter((item) => item.checked).length,
    promoted: note.items.filter((item) => item.status === 'promoted').length,
  };
}

export function promoteItem(
  item: ListItem,
  promotedTo: NonNullable<ListItem['promotedTo']>,
): ListItem {
  return { ...item, status: 'promoted', promotedTo };
}

function withOrder(items: ListItem[]): ListItem[] {
  return items.map((item, index) => (item.order === index ? item : { ...item, order: index }));
}

/** Moves an item by `delta` positions and renumbers the list. Out-of-range moves are no-ops. */
export function moveListItem(items: ListItem[], itemId: string, delta: number): ListItem[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((item) => item.id === itemId);
  if (index === -1) return items;
  const target = index + delta;
  if (target < 0 || target >= sorted.length) return items;
  const reordered = [...sorted];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);
  return withOrder(reordered);
}
