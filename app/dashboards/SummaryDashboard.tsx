'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import MultiSelect from 'app/ui/MultiSelect';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
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
import { heading2, textSecondary, CHART_COLORS } from 'app/ui/design-tokens';
import FilterBar from 'app/ui/FilterBar';

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
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
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

  const resetFilters = () => {
    setMonthFilters([]);
    setFleetFilters([]);
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
  const monthOptions = useMemo(() => {
    const unique = new Map<string, string>();
    alertRows.forEach((row) => { if (row.monthKey && row.monthLabel) unique.set(row.monthKey, row.monthLabel); });
    return Array.from(unique.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => b.key.localeCompare(a.key));
  }, [alertRows]);
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

          {/* ① Filters — set context first */}
          <FilterBar>
            <InlineMonthPicker
              value={monthFilters}
              onChange={(v) => setMonthFilters(v as string[])}
              multi
              lang={lang}
            />
            {!organizationName && (
              <MultiSelect
                label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
                options={fleetOptions}
                selected={fleetFilters}
                onChange={setFleetFilters}
                lang={lang}
              />
            )}
            {(monthFilters.length + fleetFilters.length) > 0 && (
              <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
              </button>
            )}
          </FilterBar>

          {/* ② Overview — headline numbers + safety score */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total Alerts'}
              value={currentRows.length}
              accentColor="#DC2626"
              trend={activeMonthKey ? { value: previousRows.length === 0 ? 0 : Math.round(((currentRows.length - previousRows.length) / Math.max(1, previousRows.length)) * 100), label: lang === 'th' ? 'เทียบเดือนก่อน' : 'vs last month' } : undefined}
            />
            <div className={`${dashboardSectionClass} flex flex-col items-center justify-center gap-2`}>
              <SafetyScore score={safetyScore} size={90} />
              {activeMonthKey && prevSafetyScore !== safetyScore && (
                <TrendIndicator current={safetyScore} previous={prevSafetyScore} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior'} invertColor />
              )}
            </div>
            <KpiCard label={lang === 'th' ? 'ยานพาหนะ' : 'Vehicles'} value={uniqueVehicles} subtitle={lang === 'th' ? 'ยานพาหนะที่ใช้งาน' : 'Active vehicles'} />
            <KpiCard label={lang === 'th' ? 'คนขับ' : 'Drivers'} value={uniqueDrivers} subtitle={lang === 'th' ? 'คนขับที่ใช้งาน' : 'Active drivers'} />
          </div>

          {/* ③ Monthly Trend — full-width, sets the narrative arc */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly alert trend'}</h2>
            <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'จำนวนการแจ้งเตือนรายเดือน' : 'Alert count over time.'}</p>
            <TrendChart className="mt-4" data={monthlyTrendData} mode="line" height={240} />
          </section>

          {/* ═══ Alert Breakdown ═══ */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent dark:via-amber-600/30" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              {lang === 'th' ? 'วิเคราะห์การแจ้งเตือน' : 'Alert Breakdown'}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent dark:via-amber-600/30" />
          </div>

          {/* ④ Heatmap + Alert Type donut — when & what */}
          <div className="grid gap-6 lg:grid-cols-5">
            <section className={`${dashboardSectionClass} lg:col-span-3`}>
              <h2 className={heading2}>{lang === 'th' ? 'ช่วงเวลาที่เกิดการแจ้งเตือน' : 'Alert timing heatmap'}</h2>
              <p className={`mt-1 mb-4 ${textSecondary}`}>{lang === 'th' ? 'ความถี่ตามวันและเวลา' : 'Frequency by day and hour.'}</p>
              <AlertHeatmap dates={heatmapDates} />
            </section>
            <section className={`${dashboardSectionClass} lg:col-span-2`}>
              <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนประเภท' : 'By alert type'}</h2>
              <div className="mt-4">
                <DonutChart data={remarkSummary.map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} size={150} />
              </div>
            </section>
          </div>

          {/* ⑤ Alert Type Highlights — detailed counts */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>
              {lang === 'th' ? 'ไฮไลต์ประเภทการแจ้งเตือน' : 'Alert type highlights'}
            </h2>
            <p className={`mt-1 ${textSecondary}`}>
              {activeMonthKey
                ? (lang === 'th' ? `${activeMonthLabel} — เปรียบเทียบเดือนก่อน` : `${activeMonthLabel} — compared to prior month.`)
                : (lang === 'th' ? `${activeMonthLabel}` : `${activeMonthLabel} totals.`)}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {highlightItems.map((item, idx) => {
                const accentColor = CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
                    style={{ borderLeft: `3px solid ${accentColor}` }}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
                      {item.label}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight" style={{ color: accentColor }}>
                      {item.current}
                    </div>
                    {activeMonthKey && (
                      <div className="mt-1">
                        <TrendIndicator current={item.current} previous={item.previous} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior'} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══ People & Vehicles ═══ */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {lang === 'th' ? 'คนขับและยานพาหนะ' : 'Drivers & Vehicles'}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ⑥ Driver Leaderboards */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashboardSectionClass}>
              <DriverLeaderboard drivers={driverLeaderboardData} title={lang === 'th' ? 'คนขับที่ปลอดภัยที่สุด' : 'Safest Drivers'} variant="safest" />
            </section>
            <section className={dashboardSectionClass}>
              <DriverLeaderboard drivers={driverLeaderboardData} title={lang === 'th' ? 'คนขับที่ต้องปรับปรุง' : 'Needs Improvement'} variant="riskiest" />
            </section>
          </div>

          {/* ⑦ Vehicle + Driver donuts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนตามยานพาหนะ' : 'Alerts by vehicle'}</h2>
              <div className="mt-4">
                <DonutChart data={vehicleSummary.slice(0, 8).map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} size={140} />
              </div>
            </section>
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนตามคนขับ' : 'Alerts by driver'}</h2>
              <div className="mt-4">
                <DonutChart data={driverSummary.slice(0, 8).map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} size={140} />
              </div>
            </section>
          </div>

          {/* ═══ Deep Dive ═══ */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {lang === 'th' ? 'เจาะลึกรายเดือน' : 'Monthly Deep Dive'}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ⑧ Monthly Comparisons */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'เปรียบเทียบรายเดือน' : 'Monthly comparison by alert type'}</h2>
            <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'เปรียบเทียบทุกเดือนของแต่ละประเภท' : 'Compare each alert type across months.'}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {monthlyComparisons.slice(0, 9).map((comparison) => {
                const highest = comparison.rows.reduce((max, r) => Math.max(max, r.total), 0);
                const highestMonthKey = comparison.rows.find((r) => r.total === highest)?.monthKey;
                return (
                  <div
                    key={comparison.label}
                    className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                    style={{ background: `linear-gradient(135deg, ${comparison.color}0D 0%, transparent 60%)` }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: comparison.color }} />
                      {comparison.label}
                    </div>
                    {comparison.rows.length >= 2 && (
                      <div className="mt-1.5">
                        <TrendIndicator current={comparison.rows[0].total} previous={comparison.rows[1].total} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior'} />
                      </div>
                    )}
                    <div className="mt-2.5 space-y-1.5">
                      {comparison.rows.map((row) => {
                        const wp = highest === 0 || row.total === 0 ? 0 : Math.max((row.total / highest) * 100, 2);
                        const isHighest = highest > 0 && row.monthKey === highestMonthKey;
                        return (
                          <div key={`${comparison.label}-${row.monthKey}`}>
                            <div className="mb-0.5 flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                                {isHighest && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: comparison.color }} />}
                                {row.monthLabel}
                              </span>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.total}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div className="h-2.5 rounded-full transition-[width]" style={{ width: `${wp}%`, backgroundColor: comparison.color }} />
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
