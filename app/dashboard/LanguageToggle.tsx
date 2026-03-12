'use client';

import { useRouter } from 'next/navigation';
import { DASHBOARD_LANG_COOKIE, type DashboardLang, dashboardCopy } from './i18n-copy';
import { btnSecondary, btnSmall } from 'app/ui/design-tokens';

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
      className={`${btnSecondary} ${btnSmall}`}
    >
      {lang === 'en' ? dashboardCopy.en.thai : dashboardCopy.th.english}
    </button>
  );
}
