'use client';

import { useMemo, useState } from 'react';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { buildSimpleSummaryComparison, parseSimpleSummary } from './simpleSummaryData';
import type { SimpleSheetResult } from './simpleSheetFetch';
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import FilterBar from 'app/ui/FilterBar';
import MultiSelect from 'app/ui/MultiSelect';
import { heading2, btnSecondary } from 'app/ui/design-tokens';

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
  const chartData = useMemo(() => comparison.rows.map((row) => ({
    label: monthLabel(row.month, lang), values: row.counts,
  })), [comparison.rows, lang]);
  const chartColors = useMemo(() => {
    const colorsByType = new Map(typeColumns.map(({ type, color }) => [type, color]));
    // JavaScript places numeric type names first in object keys. Match the
    // chart's series order so each type keeps its table/filter color.
    return Object.keys(chartData[0]?.values ?? {}).map((type) => colorsByType.get(type)!);
  }, [chartData, typeColumns]);
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

  const resetFilters = () => { setMonthFilters([]); setTypeFilters([]); };
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
            <MultiSelect label={lang === 'th' ? 'เดือน' : 'months'} options={summary.months} selected={monthFilters} onChange={setMonthFilters} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'ประเภทการแจ้งเตือน' : 'alert types'} options={summary.alertTypes} selected={typeFilters} onChange={setTypeFilters} lang={lang} />
            {activeFilterCount > 0 ? <button type="button" className={`${btnSecondary} ml-auto`} onClick={resetFilters}>{lang === 'th' ? 'รีเซ็ต' : 'Reset'}</button> : null}
          </FilterBar>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total alerts'} value={numberFormat.format(comparison.total)} subtitle={lang === 'th' ? 'รวมเดือนและประเภทที่เลือก' : 'Across selected months and types'} />
            <KpiCard label={lang === 'th' ? 'เดือนที่แสดง' : 'Months shown'} value={comparison.months.length} />
            <KpiCard label={lang === 'th' ? 'ประเภทที่แสดง' : 'Alert types shown'} value={comparison.alertTypes.length} />
          </div>
          {summary.records.length === 0 ? (
            <p className={dashboardSectionClass} role="status">{lang === 'th' ? 'ยังไม่มีข้อมูลสรุปในชีต' : 'No monthly summary data in this sheet yet.'}</p>
          ) : <>
            <section className={`${dashboardSectionClass} min-w-0`}>
              <h2 className={heading2}>{chartTitle}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'แต่ละสีคือประเภทการแจ้งเตือน เลือกประเภทเพื่อดูความแตกต่างระหว่างเดือน' : 'Each color is an alert type. Select a type to compare its count across months.'}</p>
              <TrendChart key={`${monthFilters.join('|')}:${typeFilters.join('|')}`}
                className="mt-4" data={chartData} colors={chartColors} mode="bar" height={340}
                maxXAxisLabels={comparison.months.length} wholeNumberYAxis
                minCategoryWidth={Math.max(220, comparison.alertTypes.length * 28 + 48)} preserveCategoryScale
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
