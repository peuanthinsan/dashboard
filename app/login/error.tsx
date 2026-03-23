'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Login error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="max-w-md text-center">
        <h2 className={heading2}>Sign in error</h2>
        <p className={`mt-2 ${textSecondary}`}>
          Something went wrong. Please try again or go back to the sign in page.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className={btnPrimary}>
            Try again
          </button>
          <Link href="/login" className={btnSecondary}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
