type LoadingStateProps = {
  message: string;
  detail?: string;
};

export default function LoadingState({ message, detail }: LoadingStateProps) {
  return (
    <section
      className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500/20 opacity-70" />
          <svg
            className="relative h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {detail ?? 'กำลังดึงข้อมูลล่าสุดและข้อมูลเชิงลึกของแดชบอร์ด'}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`loading-card-${index}`}
            className="flex h-28 flex-col justify-between rounded-2xl border border-slate-200/70 bg-slate-100/70 p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.1)] dark:border-slate-800/70 dark:bg-slate-950/40"
          >
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-800/70" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800/60" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800/60" />
          </div>
        ))}
      </div>
    </section>
  );
}
