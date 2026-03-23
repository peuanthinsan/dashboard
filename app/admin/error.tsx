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
          Something went wrong loading the admin panel. Please try again or return to the dashboard.
        </p>
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
