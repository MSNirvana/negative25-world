import { computed, ref } from 'vue';

export const themes = ['night', 'paper', 'mist'] as const;
export type Theme = (typeof themes)[number];

const storageKey = 'negative25.theme';
const themeColors: Record<Theme, string> = {
  night: '#0f0f10',
  paper: '#f6f5f1',
  mist: '#e9eef0',
};
const mapStyles: Record<Theme, string> = {
  night: 'amap://styles/dark',
  paper: 'amap://styles/fresh',
  mist: 'amap://styles/whitesmoke',
};
const currentTheme = ref<Theme>(readStoredTheme());

function isTheme(value: string | null): value is Theme {
  return value !== null && themes.includes(value as Theme);
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'night';
  try {
    const value = window.localStorage.getItem(storageKey);
    return isTheme(value) ? value : 'night';
  } catch {
    return 'night';
  }
}

function applyTheme(next: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[next]);
}

applyTheme(currentTheme.value);

export function setTheme(next: Theme): void {
  currentTheme.value = next;
  applyTheme(next);
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(storageKey, next); } catch { /* Storage is optional. */ }
  }
}

export function mapStyleForTheme(next: Theme): string { return mapStyles[next]; }

export function useTheme() {
  return { theme: computed(() => currentTheme.value), setTheme, themes };
}
