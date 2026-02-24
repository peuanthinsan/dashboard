'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { themeToggleClassName } from 'app/theme/ThemeToggle';
import type { DashboardLang } from './i18n-copy';
import { getDashboardCopy } from './i18n-copy';

export default function AdminShortcut({ lang }: { lang: DashboardLang }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const copy = getDashboardCopy(lang);

  useEffect(() => {
    setContainer(document.getElementById('theme-controls'));
  }, []);

  if (!container) return null;

  return createPortal(
    <Link href="/admin" className={themeToggleClassName}>
      <span className="text-base" aria-hidden="true">
        ⚙️
      </span>
      {copy.goToAdmin}
    </Link>,
    container,
  );
}
