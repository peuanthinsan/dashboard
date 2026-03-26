'use client';

import DashboardCard from './DashboardCard';
import type { DashboardLang } from './i18n-copy';

type DashboardRow = {
  id: number;
  publicId: string | null;
  name: string | null;
  template: string | null;
  sheetUrl: string | null;
  companyId: number | null;
  companyName: string | null;
};

type Copy = {
  unassignedCompany: string;
  dashboardCountOne: string;
  dashboardCountMany: string;
};

const COMPANY_ACCENTS = [
  'from-red-500/10 via-red-500/5 to-transparent dark:from-red-500/20 dark:via-red-500/10',
  'from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10',
  'from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10',
  'from-violet-500/10 via-violet-500/5 to-transparent dark:from-violet-500/20 dark:via-violet-500/10',
  'from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10',
  'from-cyan-500/10 via-cyan-500/5 to-transparent dark:from-cyan-500/20 dark:via-cyan-500/10',
];

function hashCompanyName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

type Props = {
  dashboards: DashboardRow[];
  lang: DashboardLang;
  copy: Copy;
};

export function DashboardByCompany({ dashboards, lang, copy }: Props) {
  const unassigned = copy.unassignedCompany;
  const groups = new Map<string, DashboardRow[]>();

  for (const d of dashboards) {
    const key = d.companyName ?? unassigned;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === unassigned) return 1;
    if (b === unassigned) return -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  return (
    <div className="flex flex-col gap-10">
      {sortedGroups.map(([companyName, items], idx) => {
        const isUnassigned = companyName === unassigned;
        const accent = isUnassigned
          ? 'from-zinc-400/20 via-zinc-400/10 to-transparent dark:from-zinc-500/20 dark:via-zinc-500/10'
          : COMPANY_ACCENTS[hashCompanyName(companyName) % COMPANY_ACCENTS.length];
        return (
          <section
            key={companyName}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/90 shadow-card backdrop-blur-sm transition-all duration-300 hover:shadow-card-hover hover:border-zinc-300/60 dark:border-zinc-800/60 dark:bg-zinc-900/90 dark:hover:border-zinc-700/60 animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Gradient accent bar */}
            <div
              className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`}
              aria-hidden
            />
            {/* Left accent stripe */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accent} opacity-60`}
              aria-hidden
            />
            {/* Subtle brand pattern */}
            <div className="pointer-events-none absolute inset-0 brand-pattern opacity-[0.07] dark:opacity-[0.05]" />
            <div className="relative p-4 pl-5 sm:p-6 sm:pl-7">
              <div className="mb-4 flex min-w-0 items-center gap-3 sm:mb-5 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 ring-1 ring-zinc-200/60 shadow-sm dark:from-zinc-800 dark:to-zinc-900 dark:ring-zinc-700/60">
                  <svg
                    className="h-6 w-6 text-zinc-500 dark:text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {companyName}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {items.length === 1
                      ? copy.dashboardCountOne
                      : `${items.length} ${copy.dashboardCountMany}`}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
                {items.map((dashboard) => (
                  <DashboardCard
                    key={dashboard.id}
                    id={dashboard.publicId}
                    name={dashboard.name ?? ''}
                    template={dashboard.template}
                    sheetUrl={dashboard.sheetUrl ?? ''}
                    lang={lang}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
