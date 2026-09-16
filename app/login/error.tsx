'use client';

import { useEffect, useMemo, useState } from 'react';
import { recoverLoginAfterError } from './login-navigation';

import { readDashboardLangFromCookie } from 'app/dashboard/lang-client';
import { getSiteCopy } from 'app/site-i18n-copy';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

export default function LoginError({
  error,
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
    console.error('Login error:', error);
    const controller = new AbortController();
    // The action response can fail after its session cookie was already set.
    // Verify the session before recovering with a fresh dashboard document.
    void recoverLoginAfterError(async () => {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      });
      if (!response.ok) return null;
      const session = await response.json();
      return controller.signal.aborted ? null : session;
    }, (path) => {
      if (!controller.signal.aborted) window.location.replace(path);
    });
    return () => controller.abort();
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 outline-none dark:bg-zinc-950"
    >
      <div className="max-w-md text-center">
        <h2 className={heading2}>{copy.loginRouteError.title}</h2>
        <p className={`mt-2 ${textSecondary}`}>{copy.loginRouteError.description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => window.location.replace('/login')} className={btnPrimary}>
            {copy.loginRouteError.tryAgain}
          </button>
          <a href="/login" className={btnSecondary}>
            {copy.loginRouteError.backToSignIn}
          </a>
        </div>
      </div>
    </main>
  );
}
