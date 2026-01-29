type LoadingPanelProps = {
  label: string;
  hint?: string;
};

const skeletonBars = Array.from({ length: 3 }, (_, index) => index);

export default function LoadingPanel({ label, hint = 'Fetching the latest dashboard data.' }: LoadingPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-300">
          <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skeletonBars.map((bar) => (
          <div
            key={bar}
            className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-slate-100/70 p-4 shadow-[0_0_0_1px_rgba(148,163,184,0.08)] dark:border-slate-800/70 dark:bg-slate-900/50"
          >
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/70" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/70" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
