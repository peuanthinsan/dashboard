'use client';

import { useMemo, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [template, setTemplate] = useState('');
  const unassigned = copy.unassignedCompany;
  const labels =
    lang === 'th'
      ? {
          allTemplates: 'ทุกประเภท',
          clear: 'ล้างตัวกรอง',
          directory: 'ค้นหาแดชบอร์ด',
          found: 'รายการ',
          noResults: 'ไม่พบแดชบอร์ดที่ตรงกับตัวกรอง',
          noResultsHint: 'ลองค้นหาด้วยชื่ออื่นหรือเลือกทุกประเภท',
          search: 'ค้นหาตามชื่อ บริษัท หรือประเภท...',
          template: 'ประเภทแดชบอร์ด',
        }
      : {
          allTemplates: 'All types',
          clear: 'Clear filters',
          directory: 'Dashboard directory',
          found: 'results',
          noResults: 'No dashboards match these filters',
          noResultsHint: 'Try another search term or show all dashboard types.',
          search: 'Search by name, company, or type...',
          template: 'Dashboard type',
        };

  const templateOptions = useMemo(
    () => Array.from(new Set(dashboards.map((dashboard) => dashboard.template).filter((value): value is string => Boolean(value)))).sort(),
    [dashboards],
  );

  const filteredDashboards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dashboards.filter((dashboard) => {
      if (template && dashboard.template !== template) return false;
      if (!normalizedQuery) return true;
      return [dashboard.name, dashboard.companyName, dashboard.template]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [dashboards, query, template]);

  const sortedGroups = useMemo(() => {
    const groups = new Map<string, DashboardRow[]>();
    for (const dashboard of filteredDashboards) {
      const key = dashboard.companyName ?? unassigned;
      const list = groups.get(key) ?? [];
      list.push(dashboard);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === unassigned) return 1;
      if (b === unassigned) return -1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }, [filteredDashboards, unassigned]);

  const hasFilters = Boolean(query || template);

  return (
    <div className="flex flex-col gap-7">
      <section className="relative z-30 rounded-2xl border border-zinc-200/70 bg-white/90 p-3 shadow-card backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/90 sm:p-4" aria-label={labels.directory}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.directory}</span>
            <span className="relative block">
              <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-4-4" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.search}
                className="min-h-11 w-full rounded-xl border border-zinc-300/80 bg-white py-2 pl-10 pr-3 text-sm text-zinc-950 shadow-sm outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-400 focus:border-red-400 focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:border-zinc-600"
              />
            </span>
          </label>
          <label className="w-full lg:w-56">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.template}</span>
            <select
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-zinc-300/80 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm outline-none transition-all hover:border-zinc-400 focus:border-red-400 focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              <option value="">{labels.allTemplates}</option>
              {templateOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-800/80 lg:justify-center">
            <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
              {filteredDashboards.length} {labels.found}
            </span>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setTemplate('');
                }}
                className="whitespace-nowrap text-xs font-semibold text-red-600 transition hover:text-red-700 dark:text-red-400"
              >
                {labels.clear}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {filteredDashboards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-4-4" />
            </svg>
          </span>
          <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">{labels.noResults}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{labels.noResultsHint}</p>
        </div>
      ) : null}

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
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {companyName}
                  </h2>
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
