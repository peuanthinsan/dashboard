'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { formatDateKeyGB } from './dateFormat';
import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

type DrivingRow = {
  id: string;
  driver: string;
  date: Date;
  dateKey: string;
  cntDrvDurationHours: number;
  cntDrvDurationLabel: string;
  distanceKm: number;
};

const toNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDurationToHours = (value: unknown) => {
  if (!value) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const clockMatch = text.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1] ?? 0);
    const minutes = Number(clockMatch[2] ?? 0);
    const seconds = Number(clockMatch[3] ?? 0);
    return hours + minutes / 60 + seconds / 3600;
  }
  const numberHours = Number(text.replace(/[^\d.-]/g, ''));
  return Number.isFinite(numberHours) ? numberHours : 0;
};

const formatHours = (hours: number) => {
  const safeHours = Math.max(0, hours);
  const totalMinutes = Math.round(safeHours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
};

const maxBarHeight = 220;

export default function DrivingDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const copy = getDashboardCopy(lang);
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );

  const drivingRows = useMemo<DrivingRow[]>(() => {
    return rows
      .map((row, index) => {
        const rawDate = findValue(row, ['Date', 'DateTime', 'Start Time', 'Alert Date Time']);
        const date = parseDate(rawDate);
        if (!date) return null;

        const driver = String(findValue(row, ['Driver Name']) ?? 'Unknown').trim() || 'Unknown';
        const distanceKm = toNumber(findValue(row, ['Distance']));
        const rawDuration = findValue(row, ['Cnt Drv duration', 'DriveHrs duration', 'Duration']);
        const cntDrvDurationHours = parseDurationToHours(rawDuration);

        return {
          id: `${dashboardId}-${index}`,
          driver,
          date,
          dateKey: date.toISOString().slice(0, 10),
          distanceKm,
          cntDrvDurationHours,
          cntDrvDurationLabel: formatHours(cntDrvDurationHours),
          fleet: String(findValue(row, ['Fleet']) ?? ''),
        };
      })
      .filter((row): row is DrivingRow & { fleet: string } => row != null)
      .filter((row) => {
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      })
      .map(({ fleet: _fleet, ...rest }) => rest);
  }, [dashboardId, normalizedOrganizationName, rows]);

  const driverOptions = useMemo(() => {
    const unique = new Set<string>();
    drivingRows.forEach((row) => unique.add(row.driver));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [drivingRows]);

  useEffect(() => {
    if (selectedDriver === 'all') return;
    if (!driverOptions.includes(selectedDriver)) {
      setSelectedDriver('all');
    }
  }, [driverOptions, selectedDriver]);

  const dateBounds = useMemo(() => {
    if (drivingRows.length === 0) return { min: '', max: '' };
    const sorted = [...drivingRows].sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      min: sorted[0]?.dateKey ?? '',
      max: sorted[sorted.length - 1]?.dateKey ?? '',
    };
  }, [drivingRows]);

  const filteredRows = useMemo(() => {
    const fromDate = dateRange.from ? new Date(`${dateRange.from}T00:00:00`) : null;
    const toDate = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`) : null;

    return drivingRows.filter((row) => {
      if (selectedDriver !== 'all' && row.driver !== selectedDriver) return false;
      if (fromDate && row.date < fromDate) return false;
      if (toDate && row.date > toDate) return false;
      return true;
    });
  }, [dateRange.from, dateRange.to, drivingRows, selectedDriver]);

  const kpis = useMemo(() => {
    const totalDistance = filteredRows.reduce((sum, row) => sum + row.distanceKm, 0);
    const totalCntDrvHours = filteredRows.reduce((sum, row) => sum + row.cntDrvDurationHours, 0);
    const uniqueDrivers = new Set(filteredRows.map((row) => row.driver)).size;

    return {
      tripCount: filteredRows.length,
      totalDistance,
      totalCntDrvHours,
      uniqueDrivers,
      avgDistance: filteredRows.length > 0 ? totalDistance / filteredRows.length : 0,
    };
  }, [filteredRows]);

  const dailySummary = useMemo(() => {
    const grouped = new Map<string, { date: Date; distanceKm: number; cntDrvDurationHours: number }>();
    filteredRows.forEach((row) => {
      const existing = grouped.get(row.dateKey);
      if (existing) {
        existing.distanceKm += row.distanceKm;
        existing.cntDrvDurationHours += row.cntDrvDurationHours;
        return;
      }
      grouped.set(row.dateKey, {
        date: row.date,
        distanceKm: row.distanceKm,
        cntDrvDurationHours: row.cntDrvDurationHours,
      });
    });
    return Array.from(grouped.entries())
      .map(([dateKey, value]) => ({
        dateKey,
        dateLabel: formatDateKeyGB(dateKey),
        distanceKm: value.distanceKm,
        cntDrvDurationHours: value.cntDrvDurationHours,
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [filteredRows]);

  const maxDistance = Math.max(1, ...dailySummary.map((item) => item.distanceKm));
  const maxDuration = Math.max(1, ...dailySummary.map((item) => item.cntDrvDurationHours));

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      lang={lang}
    >
      {loading ? (
        <LoadingState message={lang === 'th' ? 'กำลังโหลดแดชบอร์ดการขับขี่' : 'Loading driving dashboard'} fallbackDetail={copy.loadingDetail} />
      ) : error ? (
        <section className={dashboardSectionClass}>
          <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
        </section>
      ) : (
        <>
          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'th' ? 'ตัวกรอง' : 'Filters'}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <FilterGroup label={lang === 'th' ? 'ชื่อคนขับ' : 'Driver'}>
                <select
                  value={selectedDriver}
                  onChange={(event) => setSelectedDriver(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">{lang === 'th' ? 'คนขับทั้งหมด' : 'All drivers'}</option>
                  {driverOptions.map((driver) => (
                    <option key={driver} value={driver}>
                      {driver}
                    </option>
                  ))}
                </select>
              </FilterGroup>

              <FilterGroup label={lang === 'th' ? 'วันที่เริ่มต้น' : 'Start date'}>
                <input
                  type="date"
                  value={dateRange.from}
                  min={dateBounds.min || undefined}
                  max={dateRange.to || dateBounds.max || undefined}
                  onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </FilterGroup>

              <FilterGroup label={lang === 'th' ? 'วันที่สิ้นสุด' : 'End date'}>
                <input
                  type="date"
                  value={dateRange.to}
                  min={dateRange.from || dateBounds.min || undefined}
                  max={dateBounds.max || undefined}
                  onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </FilterGroup>
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{lang === 'th' ? 'สรุป KPI' : 'Summary KPIs'}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[{
                label: lang === 'th' ? 'จำนวนเที่ยว' : 'Trips',
                value: kpis.tripCount.toLocaleString(),
              }, {
                label: lang === 'th' ? 'ระยะทางรวม (กม.)' : 'Total distance (km)',
                value: kpis.totalDistance.toLocaleString(undefined, { maximumFractionDigits: 1 }),
              }, {
                label: lang === 'th' ? 'รวม Cnt Drv duration' : 'Total Cnt Drv duration',
                value: formatHours(kpis.totalCntDrvHours),
              }, {
                label: lang === 'th' ? 'คนขับที่พบ' : 'Drivers covered',
                value: kpis.uniqueDrivers.toLocaleString(),
              }, {
                label: lang === 'th' ? 'ระยะทางเฉลี่ย/เที่ยว' : 'Avg distance / trip',
                value: `${kpis.avgDistance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`,
              }].map((item) => (
                <article key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'th' ? 'กราฟรายวัน: Cnt Drv duration และ Distance' : 'Daily chart: Cnt Drv duration and distance'}
            </h2>
            {dailySummary.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{lang === 'th' ? 'ไม่พบข้อมูลตามตัวกรองที่เลือก' : 'No data matches the selected filters.'}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <div className="flex min-w-max items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  {dailySummary.map((item) => {
                    const distanceHeight = Math.max(6, (item.distanceKm / maxDistance) * maxBarHeight);
                    const durationHeight = Math.max(6, (item.cntDrvDurationHours / maxDuration) * maxBarHeight);
                    return (
                      <div key={item.dateKey} className="flex w-20 shrink-0 flex-col items-center gap-2">
                        <div className="flex h-[220px] items-end gap-1">
                          <div className="w-7 rounded-t bg-sky-500" style={{ height: `${distanceHeight}px` }} title={`Distance: ${item.distanceKm.toFixed(1)} km`} />
                          <div className="w-7 rounded-t bg-indigo-500" style={{ height: `${durationHeight}px` }} title={`Cnt Drv duration: ${formatHours(item.cntDrvDurationHours)}`} />
                        </div>
                        <p className="text-center text-xs text-slate-500 dark:text-slate-400">{item.dateLabel}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-sky-500" />Distance (km)</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-indigo-500" />Cnt Drv duration</span>
                </div>
              </div>
            )}
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'th' ? 'ตารางข้อมูล Cnt Drv duration' : 'Cnt Drv duration table'}
            </h2>
            <div className="mt-4 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Driver</th>
                    <th className="px-4 py-3 text-left font-semibold">Cnt Drv duration</th>
                    <th className="px-4 py-3 text-left font-semibold">Distance (km)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/30">
                  {filteredRows.slice().sort((a, b) => b.date.getTime() - a.date.getTime()).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{formatDateKeyGB(row.dateKey)}</td>
                      <td className="px-4 py-3">{row.driver}</td>
                      <td className="px-4 py-3">{row.cntDrvDurationLabel}</td>
                      <td className="px-4 py-3">{row.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
