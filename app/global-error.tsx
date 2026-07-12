'use client';

import { useEffect, useMemo, useState } from 'react';

import { readDashboardLangFromCookie } from 'app/dashboard/lang-client';
import { getSiteCopy } from 'app/site-i18n-copy';

export default function GlobalError({
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
    setLang(readDashboardLangFromCookie());
  }, []);

  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  const htmlLang = lang === 'th' ? 'th' : 'en';

  return (
    <html lang={htmlLang}>
      <body className="relative min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center px-4">
        <a href="#main-content" className="skip-to-content">
          {copy.skipToMain}
        </a>
        <main id="main-content" tabIndex={-1} className="max-w-md text-center outline-none">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{copy.globalError.title}</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{copy.globalError.description}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            {copy.globalError.tryAgain}
          </button>
        </main>
      </body>
    </html>
  );
}
