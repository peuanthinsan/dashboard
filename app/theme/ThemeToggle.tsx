'use client';

import { useEffect, useState } from 'react';
import { btnSecondary, btnSmall } from 'app/ui/design-tokens';

type Theme = 'light' | 'dark';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read actual DOM state set by inline script in <head>
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    // Use same key as the inline script in layout.tsx
    localStorage.setItem('theme', next);
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`${btnSecondary} ${btnSmall} rounded-full`}
    >
      <span className="text-base" aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
