'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

const isDev = typeof window !== 'undefined' && window.location?.hostname === 'localhost';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className={heading2}>Dashboard error</h2>
        <p className={`mt-2 ${textSecondary}`}>
          We couldn&apos;t load this dashboard. The data source may be unavailable or you may not have access.
        </p>
        {isDev && error?.message && (
          <p className="mt-3 rounded bg-red-50 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className={btnPrimary}
          >
            Try again
          </button>
          <Link href="/dashboard" className={btnSecondary}>
            Back to dashboards
          </Link>
        </div>
      </div>
    </div>
  );
}
