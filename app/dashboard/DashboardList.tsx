'use client';

import Link from 'next/link';

type Dashboard = {
  id: number;
  publicId: string | null;
  name: string;
  template: string;
  sheetUrl: string;
};

const badgeClass =
  'inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800/80 dark:text-slate-300';
const cardClass =
  'group flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-xl dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-600';

type DashboardListProps = {
  dashboards: Dashboard[];
};

export default function DashboardList({ dashboards }: DashboardListProps) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your dashboards</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Jump right back into the dashboards you use most and explore the latest insights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
            {dashboards.length} Total
          </span>
        </div>
      </div>

      {dashboards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">No dashboards assigned yet.</p>
          <p className="mt-2">
            Ask an administrator to add a dashboard for your companies or organizations.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`/dashboard/${dashboard.publicId ?? ''}`}
              className={cardClass}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{dashboard.name}</span>
                    <div className={badgeClass}>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" />
                      {dashboard.template}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/70" />
                    Live data connected
                  </div>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:border-indigo-500/40 dark:group-hover:bg-indigo-500/10 dark:group-hover:text-indigo-200">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-gradient-to-r from-slate-50 to-white px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/70 dark:text-slate-400">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Data source
                </span>
                <span className="mt-1 block truncate font-mono text-[11px]">{dashboard.sheetUrl}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
