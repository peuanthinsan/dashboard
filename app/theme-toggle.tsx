'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const themeLabels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
};

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('theme', nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-text)] shadow-sm transition hover:border-[var(--app-border-strong)]"
      aria-pressed={theme === 'dark'}
    >
      Theme: {themeLabels[theme]}
    </button>
  );
}
