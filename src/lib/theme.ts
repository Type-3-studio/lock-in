export type ThemeMode = 'light' | 'dark' | 'system';

export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME: ThemeMode = 'system';

const THEME_KEY = 'lock-in:theme';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Pure: maps a user preference + OS setting to the theme that should actually render. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function loadTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return isThemeMode(stored) ? stored : DEFAULT_THEME;
}

export function saveTheme(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies the resolved theme to the document root. Violet is the only accent. */
export function applyTheme(mode: ThemeMode): void {
  const dark = resolveTheme(mode, systemPrefersDark()) === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#161020' : '#ffffff');
}
