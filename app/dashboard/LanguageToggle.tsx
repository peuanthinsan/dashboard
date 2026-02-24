'use client';

import { useRouter } from 'next/navigation';
import { DASHBOARD_LANG_COOKIE, type DashboardLang, dashboardCopy } from './i18n-copy';

export default function LanguageToggle({ lang }: { lang: DashboardLang }) {
  const router = useRouter();
  const nextLang: DashboardLang = lang === 'en' ? 'th' : 'en';

  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${DASHBOARD_LANG_COOKIE}=${nextLang}; path=/; max-age=31536000; SameSite=Lax`;
        router.refresh();
      }}
      className="rounded-full border border-fuchsia-300 bg-fuchsia-100 px-4 py-2 text-sm font-semibold text-fuchsia-700 transition hover:bg-fuchsia-200 dark:border-fuchsia-600/70 dark:bg-fuchsia-500/20 dark:text-fuchsia-100"
    >
      {lang === 'en' ? dashboardCopy.en.thai : dashboardCopy.th.english}
    </button>
  );
}
