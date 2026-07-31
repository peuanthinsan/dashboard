'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { readDashboardLangFromCookie } from 'app/dashboard/lang-client';
import { getSiteCopy } from 'app/site-i18n-copy';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Start from the server default so the first client render matches the SSR HTML, then
  // correct to the user's cookie language after mount (reading the cookie during render
  // would diverge from the server and trip a hydration mismatch).
  const [lang, setLang] = useState<ReturnType<typeof readDashboardLangFromCookie>>('th');
  const copy = useMemo(() => getSiteCopy(lang), [lang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser-only cookie must be read after the hydration-safe server-default render
    setLang(readDashboardLangFromCookie());
  }, []);

  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 outline-none"
    >
      <div className="max-w-md text-center">
        <h2 className={heading2}>{copy.routeError.title}</h2>
        <p className={`mt-2 ${textSecondary}`}>{copy.routeError.description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className={btnPrimary}>
            {copy.routeError.tryAgain}
          </button>
          <Link href="/dashboard" className={btnSecondary}>
            {copy.routeError.backToDashboard}
          </Link>
        </div>
      </div>
    </main>
  );
}
