'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { themeToggleClassName } from 'app/theme/ThemeToggle';

export default function AdminShortcut() {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById('theme-controls'));
  }, []);

  if (!container) return null;

  return createPortal(
    <Link href="/admin" className={themeToggleClassName}>
      <span className="text-base" aria-hidden="true">
        ⚙️
      </span>
      Go to administration
    </Link>,
    container,
  );
}
