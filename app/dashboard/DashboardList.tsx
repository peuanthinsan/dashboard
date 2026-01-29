'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FilterChip } from 'app/dashboards/FilterChip';

type DashboardListItem = {
  id: number;
  publicId: string;
  name: string | null;
  template: string | null;
  sheetUrl: string | null;
};

type SortOption = 'name-asc' | 'name-desc' | 'template-asc';

const emptyStateClass =
  'rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400';

const getTemplateLabel = (template: string | null) => (template?.trim() ? template.trim() : 'Unassigned');

const buildSearchText = (dashboard: DashboardListItem) =>
  [dashboard.name, dashboard.template, dashboard.sheetUrl].filter(Boolean).join(' ').toLowerCase();

const sorters: Record<SortOption, (a: DashboardListItem, b: DashboardListItem) => number> = {
  'name-asc': (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  'name-desc': (a, b) => (b.name ?? '').localeCompare(a.name ?? ''),
  'template-asc': (a, b) => getTemplateLabel(a.template).localeCompare(getTemplateLabel(b.template)),
};

export default function DashboardList({ dashboards }: { dashboards: DashboardListItem[] }) {
  const [search, setSearch] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOption>('name-asc');

  const templateOptions = useMemo(() => {
    const labels = dashboards.map((dashboard) => getTemplateLabel(dashboard.template));
    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b));
  }, [dashboards]);

  const matchingDashboards = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();
    return dashboards
      .filter((dashboard) => {
        if (!loweredSearch) return true;
        return buildSearchText(dashboard).includes(loweredSearch);
      })
      .filter((dashboard) => {
        if (selectedTemplates.length === 0) return true;
        return selectedTemplates.includes(getTemplateLabel(dashboard.template));
      })
      .sort(sorters[sortOrder]);
  }, [dashboards, search, selectedTemplates, sortOrder]);

  const hasFilters = search.trim().length > 0 || selectedTemplates.length > 0;
  const clearFilters = () => {
    setSearch('');
    setSelectedTemplates([]);
  };

  const toggleTemplate = (template: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(template) ? prev.filter((value) => value !== template) : [...prev, template],
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Available dashboards</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tailored views based on your companies and organizations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
            {matchingDashboards.length} of {dashboards.length}
          </span>
          {hasFilters ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="flex flex-col gap-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Search dashboards
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, template, or sheet link"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/40"
            />
          </label>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            {templateOptions.map((template) => (
              <FilterChip
                key={template}
                onClick={() => toggleTemplate(template)}
                className={selectedTemplates.includes(template) ? undefined : 'opacity-70'}
              >
                {template}
              </FilterChip>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Sort dashboards
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOption)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/40"
          >
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="template-asc">Template (A → Z)</option>
          </select>
        </label>
      </div>

      {dashboards.length === 0 ? (
        <div className={emptyStateClass}>
          No dashboards are assigned to your companies yet. Ask an administrator to add one.
        </div>
      ) : matchingDashboards.length === 0 ? (
        <div className={emptyStateClass}>
          No dashboards match your current search. Try clearing filters or adjusting the keyword.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matchingDashboards.map((dashboard) => {
            const templateLabel = getTemplateLabel(dashboard.template);
            return (
              <Link
                key={dashboard.id}
                href={`/dashboard/${dashboard.publicId}`}
                className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-xl dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-semibold text-slate-900 dark:text-white">
                        {dashboard.name ?? 'Untitled dashboard'}
                      </span>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" />
                        {templateLabel}
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
                  <span className="mt-1 block truncate font-mono text-[11px]">
                    {dashboard.sheetUrl ?? 'No source linked'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
