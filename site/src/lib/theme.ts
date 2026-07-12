import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ddm-theme';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // localStorage unavailable — fall through to the system preference.
  }
  return undefined;
}

let currentTheme: Theme = readStoredTheme() ?? systemTheme();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Called once on boot; index.html applies the same attribute pre-paint. */
export function initTheme(): void {
  apply(currentTheme);
}

export function getTheme(): Theme {
  return currentTheme;
}

export function toggleTheme(): void {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, currentTheme);
  } catch {
    // Persisting the theme is best-effort.
  }
  apply(currentTheme);
  listeners.forEach((listener) => listener());
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getTheme);
  return { theme, toggle: toggleTheme };
}
