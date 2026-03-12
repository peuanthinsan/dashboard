'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { FilterChip } from './FilterChip';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
import LoadingState from './LoadingState';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  computeDriverSafetyScore,
  computeSafetyScore,
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  normalizeLabel,
  parseDate,
  toDisplayString,
  toMonthKey,
  toMonthLabel,
  withDerivedRemark,
} from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import DonutChart from 'app/ui/DonutChart';
import SafetyScore from 'app/ui/SafetyScore';
import TrendIndicator from 'app/ui/TrendIndicator';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import DriverLeaderboard from 'app/ui/DriverLeaderboard';
import ExportButton from 'app/ui/ExportButton';
import TrendChart from 'app/ui/TrendChart';
import { inputBase, heading2, textSecondary, CHART_COLORS } from 'app/ui/design-tokens';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

const buildCounts = (rows: Record<string, any>[], labels: string[]) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const value = findValue(row, labels);
    const key = value == null || value === '' ? 'Unspecified' : String(value).trim() || 'Unspecified';
    totals.set(key, (totals.get(key) ?? 0) + 1);
  });
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
};

export default function SummaryDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );

  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const [monthSearch, setMonthSearch] = useState('');
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);
  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  useEffect(() => {
    const stored = loadStoredFilters<{
      monthFilters: string[];
      fleetFilters: string[];
    }>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    if (Array.isArray(stored.monthFilters)) setMonthFilters(stored.monthFilters.filter((v) => typeof v === 'string'));
    if (Array.isArray(stored.fleetFilters)) setFleetFilters(stored.fleetFilters.filter((v) => typeof v === 'string'));
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, { monthFilters, fleetFilters });
  }, [fleetFilters, monthFilters, storageKey]);

  const handleSearchAdd = <T,>(
    searchValue: string,
    findMatch: (trimmed: string) => T | undefined,
    onMatch: (match: T) => void,
    clearSearch: () => void,
  ) => {
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    const matched = findMatch(trimmed);
    if (!matched) return;
    onMatch(matched);
    clearSearch();
  };

  const resetFilters = () => {
    setMonthSearch(''); setMonthFilters([]);
    setFleetSearch(''); setFleetFilters([]);
  };

  const allowedAlertTypes = useMemo(() => ALLOWED_ALERT_TYPES, []);
  const allowedRemarkTargets = useMemo(() => ALLOWED_REMARK_TARGETS, []);

  const alertRows = useMemo(() => {
    const mappedRows = rows.map((row) => {
      const alertType = toDisplayString(findValue(row, ['Alert Type']));
      const driver = toDisplayString(findValue(row, ['Driver Name']));
      const fleet = toDisplayString(findValue(row, ['Fleet']));
      const remarks = withDerivedRemark(alertType, toDisplayString(findValue(row, ['Remarks'])));
      const vehicle = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH']));
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsedDate = parseDate(dateValue);
      const monthKey = parsedDate ? toMonthKey(parsedDate) : null;
      const monthLabel = parsedDate ? toMonthLabel(parsedDate) : 'Unknown month';
      return { alertType, driver, fleet, remarks, vehicle, monthKey, monthLabel, dateValue, parsedDate };
    });
    const remarkRows = mappedRows.filter((row) => hasRemark(row.remarks) && !isExcludedAlertRemark(row.remarks));
    if (!normalizedOrganizationName) return remarkRows;
    return remarkRows.filter((row) => normalizeLabel(row.fleet) === normalizedOrganizationName);
  }, [normalizedOrganizationName, rows]);

  // Filter options
  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => { if (row.fleet && row.fleet !== '—') unique.add(row.fleet); });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);
  const filteredFleetOptions = useMemo(() => {
    const s = fleetSearch.trim();
    if (!s) return fleetOptions;
    const n = normalizeLabel(s);
    return fleetOptions.filter((o) => normalizeLabel(o).includes(n));
  }, [fleetOptions, fleetSearch]);
  const monthOptions = useMemo(() => {
    const unique = new Map<string, string>();
    alertRows.forEach((row) => { if (row.monthKey && row.monthLabel) unique.set(row.monthKey, row.monthLabel); });
    return Array.from(unique.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => b.key.localeCompare(a.key));
  }, [alertRows]);
  const filteredMonthOptions = useMemo(() => {
    const s = monthSearch.trim();
    if (!s) return monthOptions;
    const n = normalizeLabel(s);
    return monthOptions.filter((o) => normalizeLabel(o.label).includes(n));
  }, [monthOptions, monthSearch]);

  useEffect(() => {
    if (didSetDefaultMonth.current) return;
    if (monthOptions.length === 0) return;
    if (monthFilters.length > 0) { didSetDefaultMonth.current = true; return; }
    didSetDefaultMonth.current = true;
    if (monthOptions.some((o) => o.key === currentMonthKey)) setMonthFilters([currentMonthKey]);
  }, [currentMonthKey, monthFilters, monthOptions]);

  // Filtered data — only filter by allowed alert types + fleet
  const baseFilteredRows = useMemo(() => {
    const nAllowed = allowedAlertTypes.map((a) => normalizeLabel(a));
    const nFleet = fleetFilters.map((f) => normalizeLabel(f));
    return alertRows.filter((row) => {
      if (!row.alertType || row.alertType === '—') return false;
      if (!nAllowed.includes(normalizeLabel(row.alertType))) return false;
      if (nFleet.length > 0 && !nFleet.includes(normalizeLabel(row.fleet))) return false;
      return true;
    });
  }, [alertRows, allowedAlertTypes, fleetFilters]);

  const activeMonthKey = monthFilters.length === 1 ? monthFilters[0] : null;
  const activeMonthLabel = activeMonthKey
    ? monthOptions.find((o) => o.key === activeMonthKey)?.label ?? 'All months'
    : monthFilters.length > 1 ? 'Selected months' : 'All months';

  const currentRows = useMemo(() => {
    if (monthFilters.length === 0) return baseFilteredRows;
    return baseFilteredRows.filter((row) => row.monthKey && monthFilters.includes(row.monthKey));
  }, [baseFilteredRows, monthFilters]);

  const previousMonthKey = useMemo(() => {
    if (!activeMonthKey) return null;
    const [y, m] = activeMonthKey.split('-').map(Number);
    if (!y || !m) return null;
    return toMonthKey(new Date(y, m - 2, 1));
  }, [activeMonthKey]);

  const previousRows = useMemo(() => {
    if (!previousMonthKey) return [];
    return baseFilteredRows.filter((row) => row.monthKey === previousMonthKey);
  }, [baseFilteredRows, previousMonthKey]);

  const countMatches = useCallback(
    (targetLabel: string, field: 'remarks' | 'alertType', dataset: typeof currentRows) => {
      const nt = normalizeLabel(targetLabel);
      return dataset.reduce((total, row) => {
        const value = field === 'remarks' ? row.remarks : row.alertType;
        if (!value || value === '—') return total;
        const nv = normalizeLabel(value);
        return field === 'remarks' ? (nv.includes(nt) ? total + 1 : total) : (nv === nt ? total + 1 : total);
      }, 0);
    },
    [],
  );

  // KPI data
  const uniqueVehicles = useMemo(() => new Set(currentRows.map((r) => r.vehicle).filter((v) => v !== '—')).size, [currentRows]);
  const uniqueDrivers = useMemo(() => new Set(currentRows.map((r) => r.driver).filter((d) => d !== '—')).size, [currentRows]);
  const prevUniqueVehicles = useMemo(() => new Set(previousRows.map((r) => r.vehicle).filter((v) => v !== '—')).size, [previousRows]);

  // Day count for safety score
  const dayCount = useMemo(() => {
    const days = new Set<string>();
    currentRows.forEach((r) => { if (r.parsedDate) days.add(r.parsedDate.toISOString().slice(0, 10)); });
    return Math.max(1, days.size);
  }, [currentRows]);

  const safetyScore = useMemo(
    () => computeSafetyScore(currentRows.length, Math.max(1, uniqueVehicles), dayCount),
    [currentRows.length, uniqueVehicles, dayCount],
  );
  const prevDayCount = useMemo(() => {
    const days = new Set<string>();
    previousRows.forEach((r) => { if (r.parsedDate) days.add(r.parsedDate.toISOString().slice(0, 10)); });
    return Math.max(1, days.size);
  }, [previousRows]);
  const prevSafetyScore = useMemo(
    () => computeSafetyScore(previousRows.length, Math.max(1, prevUniqueVehicles), prevDayCount),
    [previousRows.length, prevUniqueVehicles, prevDayCount],
  );

  // Heatmap dates
  const heatmapDates = useMemo(
    () => currentRows.map((r) => r.parsedDate).filter((d): d is Date => d !== null),
    [currentRows],
  );

  // Monthly trend data for TrendChart
  const monthlyTrendData = useMemo(() => {
    const monthsAsc = [...monthOptions].sort((a, b) => a.key.localeCompare(b.key));
    return monthsAsc.map((month) => {
      const count = baseFilteredRows.filter((r) => r.monthKey === month.key).length;
      return { label: month.label, value: count };
    });
  }, [baseFilteredRows, monthOptions]);

  // Driver leaderboard
  const driverLeaderboardData = useMemo(() => {
    const driverAlerts = new Map<string, number>();
    const driverDays = new Map<string, Set<string>>();
    currentRows.forEach((r) => {
      if (r.driver === '—') return;
      driverAlerts.set(r.driver, (driverAlerts.get(r.driver) ?? 0) + 1);
      if (r.parsedDate) {
        const days = driverDays.get(r.driver) ?? new Set();
        days.add(r.parsedDate.toISOString().slice(0, 10));
        driverDays.set(r.driver, days);
      }
    });
    return Array.from(driverAlerts.entries()).map(([name, count]) => ({
      name,
      alertCount: count,
      score: computeDriverSafetyScore(count, Math.max(1, driverDays.get(name)?.size ?? 1)),
    }));
  }, [currentRows]);

  // Donut chart data — V2: alert type, vehicle, driver (replace fleet with driver)
  const remarkSummary = useMemo(() => buildCounts(currentRows, ['remarks']), [currentRows]);
  const vehicleSummary = useMemo(() => buildCounts(currentRows, ['vehicle']), [currentRows]);
  const driverSummary = useMemo(() => buildCounts(currentRows, ['driver']), [currentRows]);

  // Highlights
  const highlightItems = useMemo(() => {
    type HighlightItem = { label: string; field: 'remarks' | 'alertType'; current: number; previous: number };
    const items: HighlightItem[] = allowedRemarkTargets.map((label) => ({
      label,
      field: 'remarks' as const,
      current: countMatches(label, 'remarks', currentRows),
      previous: countMatches(label, 'remarks', previousRows),
    }));
    items.push({
      label: 'Forward Collision-A2',
      field: 'alertType',
      current: countMatches('Forward Collision-A2', 'alertType', currentRows),
      previous: countMatches('Forward Collision-A2', 'alertType', previousRows),
    });
    return items.filter((item) => item.current > 0);
  }, [allowedRemarkTargets, countMatches, currentRows, previousRows]);

  // Monthly comparisons
  const monthlyComparisons = useMemo(() => {
    const monthsAsc = [...monthOptions].sort((a, b) => a.key.localeCompare(b.key));
    const targets = [
      ...allowedRemarkTargets.map((l) => ({ label: l, field: 'remarks' as const })),
      { label: 'Forward Collision-A2', field: 'alertType' as const },
    ];
    return targets
      .map((item, index) => {
        const monthRows = monthsAsc.map((month) => {
          const mRows = baseFilteredRows.filter((r) => r.monthKey === month.key);
          return { monthKey: month.key, monthLabel: month.label, total: countMatches(item.label, item.field, mRows) };
        }).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        const total = monthRows.reduce((sum, r) => sum + r.total, 0);
        return { label: item.label, color: CHART_COLORS[index % CHART_COLORS.length], rows: monthRows, total };
      })
      .filter((c) => c.total > 0)
      .map(({ total: _total, ...c }) => c);
  }, [allowedRemarkTargets, baseFilteredRows, countMatches, monthOptions]);

  // Export data
  const exportData = useMemo(() => {
    return currentRows.map((r) => ({
      'Alert Type': r.alertType,
      'Driver': r.driver,
      'Vehicle': r.vehicle,
      'Fleet': r.fleet,
      'Remarks': r.remarks,
      'Month': r.monthLabel,
      'Date': r.parsedDate ? r.parsedDate.toISOString().slice(0, 10) : '',
    }));
  }, [currentRows]);

  const filterInputClass = `${inputBase} !py-1 !text-xs`;

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดภาพรวม' : 'Summary dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={lastUpdated ? (Date.now() - lastUpdated.getTime()) > 5 * 60 * 1000 : false}
      activeFilterCount={monthFilters.length + fleetFilters.length}
      actions={<ExportButton data={exportData} dashboardName={`${dashboardName}-summary`} dateRange={activeMonthKey ?? undefined} label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'} />}
    >
      {(loading || error) ? (
        <LoadingState
          message={lang === 'th' ? 'กำลังโหลดภาพรวม…' : 'Loading summary…'}
          detail={lang === 'th' ? 'กำลังสรุป KPI ระดับสูง' : 'Compiling high-level KPI totals.'}
          error={error ?? undefined}
          onRetry={() => window.location.reload()}
          lang={lang}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI Row — 4 cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total Alerts'} value={currentRows.length}
              trend={activeMonthKey ? { value: previousRows.length === 0 ? 0 : Math.round(((currentRows.length - previousRows.length) / Math.max(1, previousRows.length)) * 100), label: lang === 'th' ? 'เทียบเดือนก่อน' : 'vs last month' } : undefined} />
            <div className={`${dashboardSectionClass} flex items-center justify-center`}>
              <SafetyScore score={safetyScore} size={100} />
            </div>
            <KpiCard label={lang === 'th' ? 'ยานพาหนะ' : 'Vehicles'} value={uniqueVehicles} subtitle={lang === 'th' ? 'ยานพาหนะที่ใช้งาน' : 'Active vehicles'} />
            <KpiCard label={lang === 'th' ? 'คนขับ' : 'Drivers'} value={uniqueDrivers} subtitle={lang === 'th' ? 'คนขับที่ใช้งาน' : 'Active drivers'} />
          </div>

          {/* Filters — Month + Fleet only */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={heading2}>{lang === 'th' ? 'ตัวกรอง' : 'Filters'}</h2>
                <p className={textSecondary}>{lang === 'th' ? 'กรองการแจ้งเตือนตามเดือนหรือฟลีท' : 'Narrow alerts by month or fleet.'}</p>
              </div>
              <button type="button" onClick={resetFilters} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                {lang === 'th' ? 'รีเซ็ตตัวกรอง' : 'Reset filters'}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {/* Month filter */}
              <FilterGroup label={lang === 'th' ? 'เดือน' : 'Months'} lang={lang} onClear={() => setMonthFilters([])} count={monthFilters.length}>
                <div className="flex flex-wrap gap-1.5">
                  {monthFilters.map((mk) => {
                    const ml = monthOptions.find((o) => o.key === mk)?.label ?? mk;
                    return <FilterChip key={mk} active onClick={() => setMonthFilters((c) => c.filter((v) => v !== mk))}>{ml} ×</FilterChip>;
                  })}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input list="month-options" value={monthSearch} onChange={(e) => setMonthSearch(e.target.value)}
                    placeholder={monthOptions.length === 0 ? (lang === 'th' ? 'ไม่มีเดือน' : 'No months') : (lang === 'th' ? 'ค้นหาเดือน' : 'Search months')}
                    className={filterInputClass} />
                  <datalist id="month-options">{filteredMonthOptions.map((o) => <option key={o.key} value={o.label} />)}</datalist>
                  <button type="button" onClick={() => handleSearchAdd(monthSearch, (t) => monthOptions.find((o) => o.key === t || normalizeLabel(o.label) === normalizeLabel(t)), (m) => setMonthFilters((c) => c.includes(m.key) ? c : [...c, m.key]), () => setMonthSearch(''))}
                    className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-200">{lang === 'th' ? 'เพิ่ม' : 'Add'}</button>
                </div>
              </FilterGroup>
              {/* Fleet filter */}
              {organizationName ? null : (
                <FilterGroup label={lang === 'th' ? 'ฟลีท' : 'Fleets'} lang={lang} onClear={() => setFleetFilters([])} count={fleetFilters.length}>
                  <div className="flex flex-wrap gap-1.5">
                    {fleetFilters.map((f) => <FilterChip key={f} active onClick={() => setFleetFilters((c) => c.filter((v) => v !== f))}>{f} ×</FilterChip>)}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input list="fleet-options" value={fleetSearch} onChange={(e) => setFleetSearch(e.target.value)}
                      placeholder={fleetOptions.length === 0 ? (lang === 'th' ? 'ไม่มีฟลีท' : 'No fleets') : (lang === 'th' ? 'ค้นหาฟลีท' : 'Search fleets')}
                      className={filterInputClass} />
                    <datalist id="fleet-options">{filteredFleetOptions.map((o) => <option key={o} value={o} />)}</datalist>
                    <button type="button" onClick={() => handleSearchAdd(fleetSearch, (t) => fleetOptions.find((o) => normalizeLabel(o) === normalizeLabel(t)), (m) => setFleetFilters((c) => c.includes(m) ? c : [...c, m]), () => setFleetSearch(''))}
                      className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-200">{lang === 'th' ? 'เพิ่ม' : 'Add'}</button>
                  </div>
                </FilterGroup>
              )}
            </div>
          </section>

          {/* Alert Type Highlights */}
          <section className={dashboardSectionClass}>
            <div>
              <h2 className={heading2}>{lang === 'th' ? 'สรุปไฮไลต์ประเภทการแจ้งเตือน' : 'Alert type highlights'}</h2>
              <p className={textSecondary}>
                {activeMonthKey
                  ? (lang === 'th' ? `แสดงยอดรวมของ ${activeMonthLabel} พร้อมเปรียบเทียบเดือนก่อน` : `Showing ${activeMonthLabel} totals with change vs last month.`)
                  : (lang === 'th' ? `แสดงยอดรวมของ ${activeMonthLabel}` : `Showing ${activeMonthLabel} totals.`)}
              </p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {highlightItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{item.current}</div>
                  {activeMonthKey ? (
                    <div className="mt-2">
                      <TrendIndicator current={item.current} previous={item.previous} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs last month'} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Temporal Patterns: Heatmap + Monthly Trend + Leaderboards */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{lang === 'th' ? 'ช่วงเวลาที่เกิดการแจ้งเตือน' : 'Alert timing heatmap'}</h2>
              <p className={`mb-4 ${textSecondary}`}>{lang === 'th' ? 'แสดงความถี่ตามวันและเวลา' : 'Alert frequency by day and hour.'}</p>
              <AlertHeatmap dates={heatmapDates} />
            </section>
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly alert trend'}</h2>
              <p className={`mb-4 ${textSecondary}`}>{lang === 'th' ? 'จำนวนการแจ้งเตือนรายเดือน' : 'Alert count over time by month.'}</p>
              <TrendChart data={monthlyTrendData} mode="line" height={260} />
            </section>
          </div>

          {/* Driver Leaderboards */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashboardSectionClass}>
              <DriverLeaderboard drivers={driverLeaderboardData} title={lang === 'th' ? 'คนขับที่ปลอดภัยที่สุด' : 'Safest Drivers'} variant="safest" />
            </section>
            <section className={dashboardSectionClass}>
              <DriverLeaderboard drivers={driverLeaderboardData} title={lang === 'th' ? 'คนขับที่ต้องปรับปรุง' : 'Needs Improvement'} variant="riskiest" />
            </section>
          </div>

          {/* Analytics Charts — V2: alert type, vehicle, driver donuts */}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className={dashboardSectionClass}>
              <h2 className={`mb-4 ${heading2}`}>{lang === 'th' ? 'สัดส่วนประเภท' : 'By alert type'}</h2>
              <DonutChart data={remarkSummary.map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} />
            </section>
            <section className={dashboardSectionClass}>
              <h2 className={`mb-4 ${heading2}`}>{lang === 'th' ? 'สัดส่วนรถ' : 'By vehicle'}</h2>
              <DonutChart data={vehicleSummary.slice(0, 8).map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} />
            </section>
            <section className={dashboardSectionClass}>
              <h2 className={`mb-4 ${heading2}`}>{lang === 'th' ? 'สัดส่วนคนขับ' : 'By driver'}</h2>
              <DonutChart data={driverSummary.slice(0, 8).map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} />
            </section>
          </div>

          {/* Monthly Comparisons */}
          <section className={dashboardSectionClass}>
            <div>
              <h2 className={heading2}>{lang === 'th' ? 'เปรียบเทียบรายเดือน' : 'Monthly comparison by alert type'}</h2>
              <p className={textSecondary}>{lang === 'th' ? 'เปรียบเทียบทุกเดือนของแต่ละประเภท' : 'Compare every month for each alert type.'}</p>
            </div>
            <div className="mt-5 grid gap-6 xl:grid-cols-3">
              {monthlyComparisons.map((comparison) => {
                const highest = comparison.rows.reduce((max, r) => Math.max(max, r.total), 0);
                return (
                  <div key={comparison.label} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: comparison.color }} />
                      {comparison.label}
                    </div>
                    {comparison.rows.length >= 2 ? (
                      <div className="mt-2">
                        <TrendIndicator
                          current={comparison.rows[0].total}
                          previous={comparison.rows[1].total}
                          suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior month'}
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 space-y-2">
                      {comparison.rows.map((row) => {
                        const wp = highest === 0 || row.total === 0 ? 0 : Math.max((row.total / highest) * 100, 2);
                        return (
                          <div key={`${comparison.label}-${row.monthKey}`}>
                            <div className="mb-0.5 flex items-center justify-between text-xs">
                              <span className="text-zinc-600 dark:text-zinc-300">{row.monthLabel}</span>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.total}</span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div className="h-2 rounded-full transition-[width]" style={{ width: `${wp}%`, backgroundColor: comparison.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
