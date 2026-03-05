'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import { findValue, normalizeLabel, parseDate, toDayKey, toDisplayString } from './dashboardDataUtils';
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
  vehicleNo: string;
  driverName: string;
  startTimeLabel: string;
  endTimeLabel: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  durationHours: number;
  alertType: string;
  dateKey: string;
  fleet: string;
  startTimestamp: number;
  cntDrvGt9: number;
  cntDrvW9: number;
};

const parseNumber = (value: unknown) => {
  if (value == null) return 0;
  const normalized = String(value).replace(/[^0-9.-]+/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function DrivingDashboard({
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
        const startDate = parseDate(findValue(row, ['Start Time', 'DateTime', 'Date']));
        const endDate = parseDate(findValue(row, ['End Time']));
        return {
          id: `${index}-${toDisplayString(findValue(row, ['Vehicle No']))}`,
          vehicleNo: toDisplayString(findValue(row, ['Vehicle No'])),
          driverName: toDisplayString(findValue(row, ['Driver Name'])),
          startTimeLabel: startDate ? formatDateTimeGB(startDate) : toDisplayString(findValue(row, ['Start Time'])),
          endTimeLabel: endDate ? formatDateTimeGB(endDate) : toDisplayString(findValue(row, ['End Time'])),
          startLocation: toDisplayString(findValue(row, ['Start Location'])),
          endLocation: toDisplayString(findValue(row, ['End Location'])),
          distance: parseNumber(findValue(row, ['Distance'])),
          durationHours: parseNumber(findValue(row, ['Cnt Drv duration', 'DriveHrs duration', 'Duration'])),
          alertType: toDisplayString(findValue(row, ['Alert Type'])),
          dateKey: startDate ? toDayKey(startDate) : '',
          fleet: toDisplayString(findValue(row, ['Fleet'])),
          startTimestamp: startDate?.getTime() ?? 0,
          cntDrvGt9: parseNumber(findValue(row, ['Cnt Drv > 9hrs', 'Cnt Drv >9hrs'])),
          cntDrvW9: parseNumber(findValue(row, ['Cnt Drv w 9hrs', 'Cnt Drv w9hrs'])),
        };
      })
      .filter((row) => {
        if (row.durationHours <= 0) return false;
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      });
  }, [normalizedOrganizationName, rows]);

  const driverOptions = useMemo(() => {
    const uniqueDrivers = new Set(
      drivingRows
        .map((row) => row.driverName)
        .filter((driverName) => driverName && driverName !== '—'),
    );
    return Array.from(uniqueDrivers).sort((a, b) => a.localeCompare(b));
  }, [drivingRows]);

  const dateBounds = useMemo(() => {
    const dateKeys = drivingRows.map((row) => row.dateKey).filter(Boolean);
    if (dateKeys.length === 0) return { min: '', max: '' };
    return { min: dateKeys.reduce((a, b) => (a < b ? a : b)), max: dateKeys.reduce((a, b) => (a > b ? a : b)) };
  }, [drivingRows]);

  const filteredRows = useMemo(() => {
    const startDate = dateRange.from ? new Date(`${dateRange.from}T00:00:00`).getTime() : null;
    const endDate = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`).getTime() : null;
    return drivingRows.filter((row) => {
      if (selectedDriver !== 'all' && row.driverName !== selectedDriver) return false;
      if (startDate && row.startTimestamp < startDate) return false;
      if (endDate && row.startTimestamp > endDate) return false;
      return true;
    });
  }, [dateRange.from, dateRange.to, drivingRows, selectedDriver]);

  const bars = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => b.durationHours - a.durationHours)
      .slice(0, 20);
  }, [filteredRows]);

  const maxDuration = useMemo(() => Math.max(1, ...bars.map((row) => row.durationHours)), [bars]);

  const stats = useMemo(() => {
    const totalDuration = filteredRows.reduce((sum, row) => sum + row.durationHours, 0);
    const totalDistance = filteredRows.reduce((sum, row) => sum + row.distance, 0);
    const gt9Count = filteredRows.reduce((sum, row) => sum + row.cntDrvGt9, 0);
    const w9Count = filteredRows.reduce((sum, row) => sum + row.cntDrvW9, 0);
    return {
      totalTrips: filteredRows.length,
      avgDuration: filteredRows.length > 0 ? totalDuration / filteredRows.length : 0,
      totalDistance,
      gt9Count,
      w9Count,
    };
  }, [filteredRows]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {error ? <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {loading ? (
        <LoadingState
          message={lang === 'th' ? 'กำลังโหลดข้อมูลการขับขี่…' : 'Loading driving data…'}
          detail={lang === 'th' ? 'กำลังเตรียมแผนภูมิชั่วโมงขับขี่' : 'Preparing driving duration charts.'}
          fallbackDetail={copy.loadingDetail}
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className={dashboardSectionClass}>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === 'th' ? 'เที่ยววิ่ง' : 'Trips'}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.totalTrips}</p>
            </article>
            <article className={dashboardSectionClass}>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === 'th' ? 'ค่าเฉลี่ยชั่วโมงขับ' : 'Avg Cnt Drv duration'}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.avgDuration.toFixed(2)}</p>
            </article>
            <article className={dashboardSectionClass}>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === 'th' ? 'Cnt Drv > 9 hrs' : 'Cnt Drv > 9 hrs'}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.gt9Count.toFixed(0)}</p>
            </article>
            <article className={dashboardSectionClass}>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === 'th' ? 'ระยะทางรวม' : 'Total distance'}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.totalDistance.toFixed(0)}</p>
            </article>
          </section>

          <section className={dashboardSectionClass}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                {lang === 'th' ? 'คนขับ' : 'Driver'}
                <select
                  value={selectedDriver}
                  onChange={(event) => setSelectedDriver(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">{lang === 'th' ? 'ทั้งหมด' : 'All drivers'}</option>
                  {driverOptions.map((driver) => (
                    <option key={driver} value={driver}>
                      {driver}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                {lang === 'th' ? 'วันที่เริ่ม' : 'Date from'}
                <input
                  type="date"
                  value={dateRange.from}
                  min={dateBounds.min || undefined}
                  max={dateBounds.max || undefined}
                  onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                {lang === 'th' ? 'ถึงวันที่' : 'Date to'}
                <input
                  type="date"
                  value={dateRange.to}
                  min={dateBounds.min || undefined}
                  max={dateBounds.max || undefined}
                  onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">{lang === 'th' ? 'แผนภูมิ Cnt Drv duration' : 'Cnt Drv duration bar chart'}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {lang === 'th' ? 'แสดงสูงสุด 20 รายการ' : 'Showing top 20 trips'}
              </p>
            </div>
            {bars.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{lang === 'th' ? 'ไม่พบข้อมูล' : 'No data available for selected filters.'}</p>
            ) : (
              <div className="mt-6 space-y-3">
                {bars.map((row) => {
                  const widthPercent = (row.durationHours / maxDuration) * 100;
                  return (
                    <div key={row.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate">{row.driverName} · {row.vehicleNo}</span>
                        <span>{row.durationHours.toFixed(2)}h</span>
                      </div>
                      <div className="h-6 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                        <div
                          className="flex h-full items-center rounded-full bg-cyan-600 px-3 text-xs font-semibold text-white"
                          style={{ width: `${Math.max(widthPercent, 4)}%` }}
                          title={`${row.driverName} ${row.durationHours.toFixed(2)}h`}
                        >
                          {row.durationHours.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-medium">{lang === 'th' ? 'รายละเอียดการขับขี่' : 'Driving details'}</h2>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">{lang === 'th' ? 'คนขับ' : 'Driver'}</th>
                    <th className="px-3 py-2">{lang === 'th' ? 'รถ' : 'Vehicle'}</th>
                    <th className="px-3 py-2">{lang === 'th' ? 'เริ่ม' : 'Start time'}</th>
                    <th className="px-3 py-2">{lang === 'th' ? 'สิ้นสุด' : 'End time'}</th>
                    <th className="px-3 py-2">{lang === 'th' ? 'ระยะทาง' : 'Distance'}</th>
                    <th className="px-3 py-2">Cnt Drv duration</th>
                    <th className="px-3 py-2">{lang === 'th' ? 'ประเภทแจ้งเตือน' : 'Alert Type'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows
                    .slice()
                    .sort((a, b) => b.startTimestamp - a.startTimestamp)
                    .slice(0, 50)
                    .map((row) => (
                      <tr key={row.id} className="border-b border-slate-200/70 dark:border-slate-800/70">
                        <td className="px-3 py-2">{row.driverName}</td>
                        <td className="px-3 py-2">{row.vehicleNo}</td>
                        <td className="px-3 py-2">{row.startTimeLabel}</td>
                        <td className="px-3 py-2">{row.endTimeLabel}</td>
                        <td className="px-3 py-2">{row.distance.toFixed(0)}</td>
                        <td className="px-3 py-2">{row.durationHours.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.alertType}</td>
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
