export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: 'Motivation gets you started. Commitment keeps you going.', author: 'Jim Rohn' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', author: 'Aristotle' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'A goal without a deadline is just a dream.', author: 'Antoine de Saint-Exupéry' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'The trouble is, you think you have time.', author: 'Buddha' },
  { text: 'Time takes it all, whether you want it to or not.', author: 'Stephen King' },
  { text: 'Suffer the pain of discipline or suffer the pain of regret.', author: 'Jim Rohn' },
];

function hash(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return value;
}

/** Deterministically picks a quote for a seed (e.g. a goal id) so it stays stable across renders. */
export function quoteFor(seed: string): Quote {
  return QUOTES[hash(seed) % QUOTES.length];
}
