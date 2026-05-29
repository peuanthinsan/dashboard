'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className={heading2}>Admin error</h2>
        <p className={`mt-2 ${textSecondary}`}>
          Something went wrong loading the admin panel. This often happens after a deploy when the
          database migration has not been run yet (missing Dashboard sheet columns). Run{' '}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:migrate</code>{' '}
          against production, then try again.
        </p>
        {process.env.NODE_ENV === 'development' && error.message ? (
          <p className="mt-3 break-all rounded bg-red-50 p-2 text-left text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
            {error.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className={btnPrimary}>
            Try again
          </button>
          <Link href="/dashboard" className={btnSecondary}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
