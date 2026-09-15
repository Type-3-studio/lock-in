export interface Accent {
  id: string;
  label: string;
  primary: string;
}

export const ACCENTS: Accent[] = [
  { id: 'violet', label: 'Violet', primary: '#6b3fa0' },
  { id: 'amber', label: 'Amber', primary: '#b45309' },
  { id: 'terminal', label: 'Terminal', primary: '#15803d' },
  { id: 'crimson', label: 'Crimson', primary: '#b91c1c' },
];

export const DEFAULT_ACCENT = 'violet';

const ACCENT_KEY = 'lock-in:accent';
const CRT_KEY = 'lock-in:crt';

export function accentById(id: string): Accent {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(hex: string, target: number, amount: number): string {
  const rgb = hexToRgb(hex);
  if (rgb === null) return hex;
  const mixed = rgb.map((channel) => Math.round(channel + (target - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function shade(hex: string): string {
  return mix(hex, 0, 0.12);
}

export function tint(hex: string): string {
  return mix(hex, 255, 0.1);
}

export function contrastFor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (rgb === null) return '#ffffff';
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

/* --------------------------- DOM application ------------------------------ */

export function applyAccent(id: string): void {
  const { primary } = accentById(id);
  const rgb = hexToRgb(primary);
  const style = document.documentElement.style;
  style.setProperty('--ion-color-primary', primary);
  style.setProperty('--ion-color-primary-rgb', rgb ? rgb.join(',') : '107,63,160');
  style.setProperty('--ion-color-primary-shade', shade(primary));
  style.setProperty('--ion-color-primary-tint', tint(primary));
  style.setProperty('--ion-color-primary-contrast', contrastFor(primary));
}

export function applyCrt(on: boolean): void {
  document.documentElement.classList.toggle('crt', on);
}

export function loadAccent(): string {
  return localStorage.getItem(ACCENT_KEY) ?? DEFAULT_ACCENT;
}

export function saveAccent(id: string): void {
  localStorage.setItem(ACCENT_KEY, id);
}

export function loadCrt(): boolean {
  return localStorage.getItem(CRT_KEY) === 'on';
}

export function saveCrt(on: boolean): void {
  localStorage.setItem(CRT_KEY, on ? 'on' : 'off');
}
