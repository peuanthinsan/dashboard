'use client';

import type { DashboardLang } from 'app/dashboard/i18n-copy';

/** Read language preference from the same cookie the dashboard uses (client-only). */
export function readDashboardLangFromCookie(): DashboardLang {
  if (typeof document === 'undefined') {
    return 'th';
  }
  const m = document.cookie.match(/(?:^|; )dashboard_lang=(en|th)(?:;|$)/);
  return m?.[1] === 'en' ? 'en' : 'th';
}
