'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'songdee-theme';

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] shadow-sm transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
      <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}
