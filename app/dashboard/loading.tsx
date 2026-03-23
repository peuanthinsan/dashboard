import { cardHover, pageContent } from 'app/ui/design-tokens';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className={pageContent}>
        <div className="flex flex-col gap-5">
          {/* Welcome banner skeleton */}
          <div className="rounded-xl border border-zinc-200/60 bg-white/80 p-6 animate-pulse dark:border-zinc-800/60 dark:bg-zinc-900/80">
            <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-2 h-6 w-64 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-1 h-4 w-56 rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-8 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>

          {/* Dashboard cards grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${cardHover} animate-pulse p-5`}>
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-3 h-6 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
