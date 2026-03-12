import { cardSection, textSecondary, btnPrimary, heading2 } from 'app/ui/design-tokens';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';

type LoadingStateProps = {
  message?: string;
  detail?: string;
  fallbackDetail?: string;
  error?: string;
  onRetry?: () => void;
  lang?: DashboardLang;
};

export default function LoadingState({
  message = 'Loading dashboard...',
  detail,
  fallbackDetail,
  error,
  onRetry,
  lang = 'en',
}: LoadingStateProps) {
  const copy = getDashboardCopy(lang);

  if (error) {
    return (
      <div className="flex flex-col gap-4" role="alert" aria-live="assertive">
        <div className={`${cardSection} flex flex-col items-center gap-4 py-10 text-center`}>
          {/* Error icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <div className="max-w-md">
            <p className={`${heading2} mb-1`}>{copy.errorTitle}</p>
            <p className={textSecondary}>{error}</p>
          </div>

          {onRetry && (
            <button type="button" onClick={onRetry} className={btnPrimary}>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              {copy.retry}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      {/* Loading header */}
      <div className={`${cardSection} flex items-center gap-4`}>
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" />
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{message}</p>
          <p className={textSecondary}>
            {detail ?? fallbackDetail ?? 'Fetching the latest data.'}
          </p>
        </div>
      </div>

      {/* KPI row — 4 skeleton cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${cardSection} animate-pulse`}>
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-3 h-7 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-2 h-2 w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Chart section — 2 wide skeleton rectangles */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={`${cardSection} animate-pulse`}>
            <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-4 h-40 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Table section — header row + 5 data rows */}
      <div className={`${cardSection} animate-pulse`}>
        {/* Table header */}
        <div className="mb-4 flex gap-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          {[40, 24, 20, 16].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-zinc-200 dark:bg-zinc-700"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div
            key={row}
            className="flex gap-4 border-b border-zinc-50 py-3 last:border-0 dark:border-zinc-800/50"
          >
            {[40, 24, 20, 16].map((w, col) => (
              <div
                key={col}
                className="h-3 rounded bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
