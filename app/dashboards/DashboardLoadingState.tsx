import { dashboardSectionClass } from './DashboardShell';

type DashboardLoadingStateProps = {
  title: string;
  description?: string;
};

const shimmerBlockClass =
  'h-20 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-100/80 via-white/60 to-slate-200/70 shadow-sm dark:border-slate-700/70 dark:from-slate-800/70 dark:via-slate-900/60 dark:to-slate-800/70';

export default function DashboardLoadingState({ title, description }: DashboardLoadingStateProps) {
  return (
    <section
      className={`${dashboardSectionClass} relative overflow-hidden`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400/30" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
            {description ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${shimmerBlockClass} animate-pulse`} />
          <div className={`${shimmerBlockClass} animate-pulse`} />
        </div>

        <div className="space-y-3">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/70" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/70" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/70" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </section>
  );
}
