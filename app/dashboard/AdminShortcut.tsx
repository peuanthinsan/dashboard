'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLanguage } from 'app/i18n';
import { themeToggleClassName } from 'app/theme/ThemeToggle';

export default function AdminShortcut() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const { language } = useLanguage();

  useEffect(() => {
    setContainer(document.getElementById('theme-controls'));
  }, []);

  if (!container) return null;

  return createPortal(
    <Link href="/admin" className={themeToggleClassName}>
      <span className="text-base" aria-hidden="true">🛠️</span>
      {language === 'th' ? 'ไปหน้าผู้ดูแลระบบ' : 'Go to administration'}
    </Link>,
    container,
  );
}
