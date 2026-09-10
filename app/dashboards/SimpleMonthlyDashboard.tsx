'use client';

import { useMemo, useState } from 'react';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { buildSimpleSummaryComparison, parseSimpleSummary } from './simpleSummaryData';
import { resolveSelectedTrendMonths, toggleTrendMonthFilter } from './detailTrendData';
import type { SimpleSheetResult } from './simpleSheetFetch';
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import ExportButton from 'app/ui/ExportButton';
import FilterBar from 'app/ui/FilterBar';
import MultiSelect from 'app/ui/MultiSelect';
import { heading2, btnSecondary, CHART_COLORS } from 'app/ui/design-tokens';

type Props = {
  dashboardId: string;
  dashboardName: string;
  dashboardNotes?: string | null;
  lang?: DashboardLang;
  isAdmin?: boolean;
  sheet: Extract<SimpleSheetResult, { kind: 'summary' }>;
  refresh: () => void;
};

const TYPE_COLORS = ['#DC2626', '#D97706', '#2563EB', '#059669', '#7C3AED', '#DB2777', '#0891B2', '#EA580C', '#4F46E5', '#65A30D', '#A16207', '#475569'];
const MONTHLY_CHART_COLORS = [CHART_COLORS[0]];
const chartPillClass = 'rounded-full px-2.5 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:focus-visible:outline-red-400';
const activeChartPillClass = 'bg-red-600 text-white';
const inactiveChartPillClass = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

function monthLabel(month: string, lang: DashboardLang) {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

export default function SimpleMonthlyDashboard({
  dashboardId, dashboardName, dashboardNotes, lang = 'en', isAdmin = false, sheet, refresh,
}: Props) {
  // Summary sheets already contain the intended scope and type classification.
  // Raw-event fleet, remark and speed rules cannot be applied to these totals.
  const summary = useMemo(() => parseSimpleSummary(sheet.columns, sheet.rows), [sheet.columns, sheet.rows]);
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [chartTypeFilter, setChartTypeFilter] = useState<string | null>(null);
  const [chartMonthFilters, setChartMonthFilters] = useState<string[]>([]);
  const comparison = useMemo(
    () => buildSimpleSummaryComparison(summary.records, monthFilters, typeFilters),
    [summary.records, monthFilters, typeFilters],
  );
  const activeFilterCount = Number(monthFilters.length > 0) + Number(typeFilters.length > 0);
  const numberFormat = useMemo(() => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-GB'), [lang]);
  const typeColumns = useMemo(() => comparison.alertTypes.map((type) => ({
    type,
    key: `alert:${type}`,
    color: TYPE_COLORS[summary.alertTypes.indexOf(type)] ?? `hsl(${summary.alertTypes.indexOf(type) * 137.508 % 360} 65% 42%)`,
  })), [comparison.alertTypes, summary.alertTypes]);
  // Page filters define the scope. These controls only narrow the graph;
  // table rows and CSV continue to use the full page comparison.
  const activeChartType = chartTypeFilter !== null && comparison.alertTypes.includes(chartTypeFilter)
    ? chartTypeFilter : null;
  const chartMonthOptions = useMemo(() => comparison.months.map((key) => ({
    key, label: monthLabel(key, lang),
  })), [comparison.months, lang]);
  const selectedChartMonths = useMemo(
    () => resolveSelectedTrendMonths(chartMonthOptions, chartMonthFilters),
    [chartMonthOptions, chartMonthFilters],
  );
  const selectedChartMonthKeys = new Set(selectedChartMonths.map(({ key }) => key));
  const allChartMonthsSelected = selectedChartMonths.length === chartMonthOptions.length;
  const chartData = useMemo(() => {
    const rowsByMonth = new Map(comparison.rows.map((row) => [row.month, row]));
    return selectedChartMonths.map(({ key, label }) => {
      const row = rowsByMonth.get(key);
      return { label, value: activeChartType === null ? row?.total ?? 0 : row?.counts[activeChartType] ?? 0 };
    });
  }, [comparison.rows, selectedChartMonths, activeChartType]);
  const tableRows = useMemo(() => comparison.rows.map((row) => ({
    month: row.month,
    ...Object.fromEntries(typeColumns.map(({ type, key }) => [key, row.counts[type]])),
    total: row.total,
  })), [comparison.rows, typeColumns]);
  const tableColumns = useMemo<Column<(typeof tableRows)[number]>[]>(() => [
    { key: 'month', label: lang === 'th' ? 'เดือน' : 'Month', sortable: true, stickyLeft: true,
      render: (value) => <span className="font-semibold">{monthLabel(String(value), lang)}</span> },
    ...typeColumns.map(({ type, key, color }) => ({
      key, label: type, sortable: true,
      render: (value: unknown) => <span className="inline-flex items-center gap-2 tabular-nums"><span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />{numberFormat.format(Number(value))}</span>,
    })),
    { key: 'total', label: lang === 'th' ? 'ทั้งหมด' : 'Total', sortable: true,
      render: (value) => <span className="font-bold tabular-nums">{numberFormat.format(Number(value))}</span> },
  ], [lang, numberFormat, typeColumns]);

  const resetChartFilters = () => { setChartTypeFilter(null); setChartMonthFilters([]); };
  const resetFilters = () => { setMonthFilters([]); setTypeFilters([]); resetChartFilters(); };
  const tableTitle = lang === 'th' ? 'ตารางสรุปรายเดือน' : 'Monthly summary table';
  const chartTitle = lang === 'th' ? 'เปรียบเทียบการแจ้งเตือนรายเดือน' : 'Monthly alert comparison';

  return (
    <DashboardShell
      title={dashboardName} subtitle={lang === 'th' ? 'สรุปการแจ้งเตือนรายเดือน' : 'Monthly alert summary'}
      lang={lang} lastUpdated={sheet.lastUpdated} notes={dashboardNotes}
      activeFilterCount={activeFilterCount} dashboardId={dashboardId} isAdmin={isAdmin}
      actions={<>
        <button type="button" className={btnSecondary} onClick={refresh}>{lang === 'th' ? 'รีเฟรช' : 'Refresh'}</button>
        {!summary.error && comparison.rows.length > 0 ? <ExportButton
          data={tableRows} columns={tableColumns.map(({ key, label }) => ({ key, label }))}
          dashboardName="SimpleMonthlySummary" dateRange={comparison.months.join('_')}
          settingsStorageKey={`simple-summary-${dashboardId}`} lang={lang}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        /> : null}
      </>}
    >
      {summary.error ? <LoadingState lang={lang} error={summary.error} onRetry={refresh} /> : (
        <div className="flex min-w-0 flex-col gap-6">
          <FilterBar title={lang === 'th' ? 'ตัวกรอง' : 'Filters'}
            description={lang === 'th' ? 'เลือกเดือนและประเภทเพื่อเปรียบเทียบ' : 'Choose months and alert types to compare.'}
            activeCount={activeFilterCount}>
            <MultiSelect label={lang === 'th' ? 'เดือน' : 'months'} options={summary.months} selected={monthFilters} onChange={(months) => { setMonthFilters(months); resetChartFilters(); }} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'ประเภทการแจ้งเตือน' : 'alert types'} options={summary.alertTypes} selected={typeFilters} onChange={(types) => { setTypeFilters(types); resetChartFilters(); }} lang={lang} />
            {activeFilterCount > 0 ? <button type="button" className={`${btnSecondary} ml-auto`} onClick={resetFilters}>{lang === 'th' ? 'รีเซ็ต' : 'Reset'}</button> : null}
          </FilterBar>
          {summary.records.length === 0 ? (
            <p className={dashboardSectionClass} role="status">{lang === 'th' ? 'ยังไม่มีข้อมูลสรุปในชีต' : 'No monthly summary data in this sheet yet.'}</p>
          ) : <>
            <section className={`${dashboardSectionClass} min-w-0`}>
              <h2 className={heading2}>{chartTitle}</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'เปรียบเทียบยอดรวมการแจ้งเตือนของแต่ละเดือน ตัวกรองด้านล่างมีผลเฉพาะกราฟนี้' : 'Compare total alerts per month. The filters below only change this graph.'}</p>
              <div className="mt-3 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={lang === 'th' ? 'กรองประเภทการแจ้งเตือนในกราฟ' : 'Filter chart by alert type'}>
                  <span className="uppercase tracking-[0.2em] text-zinc-500">{lang === 'th' ? 'แสดง' : 'Show'}</span>
                  <button type="button" onClick={() => setChartTypeFilter(null)} aria-pressed={activeChartType === null}
                    className={`${chartPillClass} ${activeChartType === null ? activeChartPillClass : inactiveChartPillClass}`}>
                    {lang === 'th' ? 'การแจ้งเตือนทุกประเภท' : 'All alert types'}
                  </button>
                  {comparison.alertTypes.map((type) => (
                    <button key={type} type="button" onClick={() => setChartTypeFilter(type)} aria-pressed={activeChartType === type}
                      className={`${chartPillClass} ${activeChartType === type ? activeChartPillClass : inactiveChartPillClass}`}>
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={lang === 'th' ? 'เลือกเดือนที่จะแสดงในกราฟ' : 'Choose months to show in chart'}>
                  <span className="uppercase tracking-[0.2em] text-zinc-500">{lang === 'th' ? 'เดือน' : 'Months'}</span>
                  <button type="button" onClick={() => setChartMonthFilters([])} aria-pressed={allChartMonthsSelected}
                    className={`${chartPillClass} ${allChartMonthsSelected ? activeChartPillClass : inactiveChartPillClass}`}>
                    {lang === 'th' ? 'ทุกเดือน' : 'All months'}
                  </button>
                  {chartMonthOptions.map(({ key, label }) => (
                    <button key={key} type="button"
                      onClick={() => setChartMonthFilters((current) => toggleTrendMonthFilter(comparison.months, current, key))}
                      aria-pressed={selectedChartMonthKeys.has(key)}
                      className={`${chartPillClass} ring-1 ring-inset ${selectedChartMonthKeys.has(key)
                        ? 'bg-white text-zinc-800 ring-zinc-300 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600'
                        : 'bg-zinc-50 text-zinc-600 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <TrendChart key={JSON.stringify([monthFilters, typeFilters, activeChartType, chartMonthFilters])}
                className="mt-4" data={chartData} colors={MONTHLY_CHART_COLORS} mode="bar" height={300}
                maxXAxisLabels={selectedChartMonths.length} wholeNumberYAxis yAxisTickCount={3}
                minCategoryWidth={96} preserveCategoryScale barCategoryPadding={0.24} maxBarWidth={72}
                singleSeriesLabel={activeChartType ?? (lang === 'th' ? 'การแจ้งเตือน' : 'Alerts')}
                ariaLabel={chartTitle}
              />
            </section>
            <section className={`${dashboardSectionClass} min-w-0`}>
              <h2 className={heading2}>{tableTitle}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'แสดงทุกประเภทจากชีต ค่า 0 หมายถึงไม่มีจำนวนสรุปสำหรับประเภทนั้นในเดือนนั้น' : 'All types come from the sheet. A zero means no count was listed for that type in that month.'}</p>
              <div className="mt-4"><DataTable columns={tableColumns} data={tableRows}
                defaultSort={{ key: 'month', direction: 'asc' }} ariaLabel={tableTitle}
              /></div>
            </section>
          </>}
        </div>
      )}
    </DashboardShell>
  );
}
