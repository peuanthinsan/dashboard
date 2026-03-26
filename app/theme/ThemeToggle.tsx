'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
  };

  return (
    <button
      type="button"
      onClick={mounted ? toggle : undefined}
      disabled={!mounted}
      aria-busy={!mounted}
      aria-label={
        mounted
          ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`
          : 'Loading appearance preference'
      }
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/60 bg-white/80 text-base shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-card-hover disabled:cursor-wait disabled:opacity-70 dark:border-zinc-700/60 dark:bg-zinc-800/80"
    >
      <span aria-hidden="true">{mounted ? (theme === 'dark' ? '☾' : '☀') : '…'}</span>
    </button>
  );
}
