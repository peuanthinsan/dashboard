'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { findValue, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';
import { formatDateTimeGB } from './dateFormat';
import { type DashboardLang } from 'app/dashboard/i18n-copy';

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
  driverName: string;
  vehicleNo: string;
  startTime: Date | null;
  endTime: Date | null;
  startLocation: string;
  endLocation: string;
  distance: string;
  cntDrvDuration: number;
  label: string;
};

const parseNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export default function DrivingDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [driverFilter, setDriverFilter] = useState('');

  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );

  const drivingRows = useMemo<DrivingRow[]>(() => {
    const mapped = rows
      .map((row) => {
        const cntDrvDuration = parseNumber(
          findValue(row, ['Cnt Drv duration', 'Cnt Drv Duration', 'Cnt Drv_duration', 'Duration']),
        );
        if (cntDrvDuration == null) return null;
        const driverName = toDisplayString(findValue(row, ['Driver Name', 'Driver']));
        const vehicleNo = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH', 'Vehicle']));
        const startTime = parseDate(findValue(row, ['Start Time', 'Track Time', 'Date']));
        const endTime = parseDate(findValue(row, ['End Time']));
        const startLocation = toDisplayString(findValue(row, ['Start Location']));
        const endLocation = toDisplayString(findValue(row, ['End Location']));
        const distance = toDisplayString(findValue(row, ['Distance']));
        const fleet = toDisplayString(findValue(row, ['Fleet']));

        return {
          driverName,
          vehicleNo,
          startTime,
          endTime,
          startLocation,
          endLocation,
          distance,
          cntDrvDuration,
          label: `${driverName} (${vehicleNo})`,
          fleet,
        };
      })
      .filter((row): row is DrivingRow & { fleet: string } => Boolean(row));

    const scoped = normalizedOrganizationName
      ? mapped.filter((row) => normalizeLabel(row.fleet) === normalizedOrganizationName)
      : mapped;

    const query = driverFilter.trim().toLowerCase();
    const filtered = query
      ? scoped.filter((row) => row.driverName.toLowerCase().includes(query))
      : scoped;

    return filtered.sort((a, b) => b.cntDrvDuration - a.cntDrvDuration);
  }, [driverFilter, normalizedOrganizationName, rows]);

  const maxDuration = useMemo(
    () => Math.max(1, ...drivingRows.map((row) => row.cntDrvDuration)),
    [drivingRows],
  );

  const avgDuration = useMemo(() => {
    if (drivingRows.length === 0) return 0;
    const total = drivingRows.reduce((sum, row) => sum + row.cntDrvDuration, 0);
    return total / drivingRows.length;
  }, [drivingRows]);

  const topRows = drivingRows.slice(0, 20);

  if (loading) {
    return (
      <DashboardShell
        title={dashboardName}
        subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
        lang={lang}
        lastUpdated={lastUpdated}
        notes={dashboardNotes}
      >
        <LoadingState
          message={lang === 'th' ? 'กำลังโหลดข้อมูลการขับขี่' : 'Loading driving insights'}
          detail={lang === 'th' ? 'กำลังดึงข้อมูลล่าสุดจาก Google Sheet' : 'Fetching the latest rows from Google Sheets.'}
        />
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell
        title={dashboardName}
        subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
        lang={lang}
        lastUpdated={lastUpdated}
        notes={dashboardNotes}
      >
        <section className={dashboardSectionClass}>
          <p className="text-sm text-rose-500">{error}</p>
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      actions={
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {lang === 'th' ? 'ค้นหาคนขับ' : 'Filter driver'}
          </label>
          <input
            value={driverFilter}
            onChange={(event) => setDriverFilter(event.target.value)}
            placeholder={lang === 'th' ? 'พิมพ์ชื่อคนขับ' : 'Type driver name'}
            className="w-56 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      }
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <article className={dashboardSectionClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{lang === 'th' ? 'รายการที่ตรงเงื่อนไข' : 'Matching rows'}</p>
          <p className="mt-2 text-3xl font-semibold">{drivingRows.length}</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{lang === 'th' ? 'ค่าเฉลี่ย Cnt Drv duration' : 'Average Cnt Drv duration'}</p>
          <p className="mt-2 text-3xl font-semibold">{avgDuration.toFixed(2)}</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{lang === 'th' ? 'สูงสุด Cnt Drv duration' : 'Max Cnt Drv duration'}</p>
          <p className="mt-2 text-3xl font-semibold">{maxDuration.toFixed(2)}</p>
        </article>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold">{lang === 'th' ? 'กราฟแท่ง Cnt Drv duration' : 'Cnt Drv duration bar chart'}</h2>
        {topRows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{lang === 'th' ? 'ไม่พบข้อมูล' : 'No data available.'}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {topRows.map((row, index) => {
              const width = `${Math.max(4, (row.cntDrvDuration / maxDuration) * 100)}%`;
              return (
                <div key={`${row.label}-${index}`} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="line-clamp-1">{row.label}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-100">{row.cntDrvDuration.toFixed(2)}</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold">{lang === 'th' ? 'รายละเอียดการขับขี่' : 'Driving details'}</h2>
        <div className="mt-4 overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">End</th>
                <th className="px-3 py-2">Distance</th>
                <th className="px-3 py-2">Cnt Drv duration</th>
              </tr>
            </thead>
            <tbody>
              {drivingRows.slice(0, 100).map((row, index) => (
                <tr key={`${row.label}-table-${index}`} className="border-t border-slate-200/70 dark:border-slate-800/70">
                  <td className="px-3 py-2">{row.driverName}</td>
                  <td className="px-3 py-2">{row.vehicleNo}</td>
                  <td className="px-3 py-2">{row.startTime ? formatDateTimeGB(row.startTime) : '—'}</td>
                  <td className="px-3 py-2">{row.endTime ? formatDateTimeGB(row.endTime) : '—'}</td>
                  <td className="px-3 py-2">{row.distance}</td>
                  <td className="px-3 py-2 font-semibold">{row.cntDrvDuration.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
