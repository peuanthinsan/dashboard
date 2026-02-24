'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from 'app/i18n';

const STORAGE_KEY = 'songdee-theme';

type Theme = 'light' | 'dark';

const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const themeToggleClassName =
  'inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-700 shadow-sm transition hover:border-fuchsia-300 hover:text-fuchsia-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-fuchsia-400 dark:hover:text-white';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const { language } = useLanguage();

  useEffect(() => {
    setTheme(getPreferredTheme());
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={language === 'th' ? 'สลับโหมดสี' : `Switch to ${nextTheme} mode`}
      className={themeToggleClassName}
    >
      <span className="text-base">{theme === 'dark' ? '☾' : '☀'}</span>
      {language === 'th' ? (theme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง') : theme === 'dark' ? 'Dark mode' : 'Light mode'}
    </button>
  );
}
