'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import {
  findValue,
  normalizeLabel,
  parseDate,
  resolveScopeFleetNames,
  scopeFleetSet,
} from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import {
  badgeDanger,
  badgeSuccess,
  badgeWarning,
  badgeDefault,
  btnSecondary,
  inputBase,
  selectBase,
  tableCell,
  tableHead,
  tableHeadCell,
  tableRow,
} from 'app/ui/design-tokens';
import {
  buildAbnormalDetails,
  deriveUnitDeviceIndicators,
  extractTruckCode,
  formatRelativeUpdated,
  indicatorIsOffline,
  type DeviceDotStatus,
  type DeviceFilterKey,
  type OverallStatus,
  type UnitDeviceIndicators,
} from './unitDeviceStatus';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  lang?: DashboardLang;
  isAdmin?: boolean;
};

type VehicleRow = {
  vehicleNo: string;
  truckCode: string;
  location: string;
  fleet: string;
  updatedAt: Date | null;
  updatedRaw: string;
  indicators: UnitDeviceIndicators;
  details: string;
};

const DEVICE_FILTER_OPTIONS: { key: DeviceFilterKey | ''; label: string }[] = [
  { key: '', label: 'All Device' },
  { key: 'gps', label: 'GPS' },
  { key: 'mcr', label: 'MCR' },
  { key: 'mdvr', label: 'MDVR' },
  { key: 'ivms', label: 'IVMS' },
  { key: 'fatigueAi', label: 'Fatigue AI' },
  { key: 'intercom', label: 'Intercom' },
  { key: 'c1', label: 'Camera 1' },
  { key: 'c2', label: 'Camera 2' },
  { key: 'c3', label: 'Camera 3' },
  { key: 'c4', label: 'Camera 4' },
  { key: 'c5', label: 'Camera 5' },
];

const OVERALL_STATUS_OPTIONS: OverallStatus[] = [
  'healthy',
  'warning',
  'offline',
  'not_installed',
];

function toText(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function StatusDot({ status, title }: { status: DeviceDotStatus; title?: string }) {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'not_installed'
        ? 'bg-zinc-400'
        : 'bg-red-500';
  return (
    <span
      title={title ?? status}
      className={`inline-block h-3 w-3 rounded-full ${color} ring-2 ring-white dark:ring-zinc-900`}
      aria-label={title ?? status}
    />
  );
}

function OverallBadge({ status, lang }: { status: OverallStatus; lang: DashboardLang }) {
  const label =
    status === 'healthy'
      ? lang === 'th' ? 'ปกติ' : 'Healthy'
      : status === 'warning'
        ? lang === 'th' ? 'เตือน' : 'Warning'
        : status === 'offline'
          ? lang === 'th' ? 'ออฟไลน์' : 'Offline'
          : lang === 'th' ? 'ไม่ได้ติดตั้ง' : 'Not Installed';
  const cls =
    status === 'healthy'
      ? badgeSuccess
      : status === 'warning'
        ? badgeWarning
        : status === 'offline'
          ? badgeDanger
          : badgeDefault;
  return <span className={cls}>{label}</span>;
}

function percent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export default function AlchemUnitStatusDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  organizationNames,
  lang = 'en',
  isAdmin = false,
}: DashboardProps) {
  const scopeNames = useMemo(
    () => resolveScopeFleetNames(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );

  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
  });

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilterKey | ''>('');
  const [statusSelect, setStatusSelect] = useState<OverallStatus | ''>('');
  const [statusChecks, setStatusChecks] = useState<Set<OverallStatus>>(
    () => new Set(OVERALL_STATUS_OPTIONS),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const filterKey = `${vehicleSearch}|${regionFilter}|${deviceFilter}|${statusSelect}|${Array.from(statusChecks).sort().join(',')}|${pageSize}`;
  const [pageFilterKey, setPageFilterKey] = useState(filterKey);
  if (pageFilterKey !== filterKey) {
    setPageFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      refresh();
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refresh]);

  const vehicleRows = useMemo<VehicleRow[]>(() => {
    return rows
      .map((row) => {
        const vehicleNo = toText(findValue(row, ['vehicleno', 'Vehicle No', 'Vehicle', 'Truck']));
        const fleet = toText(findValue(row, ['Fleet', 'fleet']));
        const location = toText(findValue(row, ['location', 'Location', 'Region']));
        const recording = toText(findValue(row, ['recording', 'Recording']));
        const videoloss = toText(findValue(row, ['videoloss', 'Video Loss', 'Videoloss']));
        const gpsRaw = findValue(row, ['gps', 'GPS', 'GPS Status']);
        const updatedRaw = toText(
          findValue(row, ['lastupdatedtime', 'Last Updated Time', 'datatime', 'Date & time', 'DateTime']),
        );
        const indicators = deriveUnitDeviceIndicators({
          vehicleNo,
          gps: gpsRaw,
          recording,
          videoloss,
        });
        return {
          vehicleNo,
          truckCode: extractTruckCode(vehicleNo) || vehicleNo,
          location,
          fleet,
          updatedAt: parseDate(updatedRaw),
          updatedRaw,
          indicators,
          details: buildAbnormalDetails(indicators, lang === 'th' ? 'th' : 'en'),
        };
      })
      .filter((row) => {
        if (!row.vehicleNo) return false;
        if (scopeSet.size === 0) return true;
        if (!row.fleet) return true; // no Fleet column on Alchem sheet → keep rows
        return scopeSet.has(normalizeLabel(row.fleet));
      });
  }, [rows, scopeSet, lang]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    vehicleRows.forEach((row) => {
      if (!row.location) return;
      // Prefer short region/depot labels (no comma = not a full address)
      if (!row.location.includes(',')) set.add(row.location);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vehicleRows]);

  const filteredRows = useMemo(() => {
    const search = normalizeLabel(vehicleSearch);
    return vehicleRows.filter((row) => {
      if (search) {
        const hay = normalizeLabel(`${row.truckCode} ${row.vehicleNo}`);
        if (!hay.includes(search)) return false;
      }
      if (regionFilter && row.location !== regionFilter) return false;
      if (deviceFilter && !indicatorIsOffline(row.indicators, deviceFilter)) return false;
      if (statusSelect && row.indicators.overall !== statusSelect) return false;
      if (statusChecks.size > 0 && !statusChecks.has(row.indicators.overall)) return false;
      return true;
    });
  }, [vehicleRows, vehicleSearch, regionFilter, deviceFilter, statusSelect, statusChecks]);

  const totals = useMemo(() => {
    const base = filteredRows;
    const healthy = base.filter((r) => r.indicators.overall === 'healthy').length;
    const warning = base.filter((r) => r.indicators.overall === 'warning').length;
    const offline = base.filter((r) => r.indicators.overall === 'offline').length;
    const notInstalled = base.filter((r) => r.indicators.overall === 'not_installed').length;
    return { total: base.length, healthy, warning, offline, notInstalled };
  }, [filteredRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleStatusCheck = (status: OverallStatus) => {
    setStatusChecks((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const activeFilterCount =
    (vehicleSearch ? 1 : 0) +
    (regionFilter ? 1 : 0) +
    (deviceFilter ? 1 : 0) +
    (statusSelect ? 1 : 0) +
    (statusChecks.size !== OVERALL_STATUS_OPTIONS.length ? 1 : 0) +
    scopeNames.length;

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'สถานะอุปกรณ์ยานพาหนะ' : 'Fleet Device Health'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      activeFilterCount={activeFilterCount}
      actions={
        <>
          <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
            />
            {lang === 'th' ? 'รีเฟรชอัตโนมัติ' : 'Auto-refresh'}
          </label>
          <button type="button" onClick={() => refresh()} className={btnSecondary}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.5 9A7 7 0 0119.07 8M18.5 15A7 7 0 014.93 16" />
            </svg>
            {lang === 'th' ? 'รีเฟรช' : 'Refresh'}
          </button>
        </>
      }
    >
      {loading || error ? (
        <LoadingState
          lang={lang}
          message={lang === 'th' ? 'กำลังโหลดสถานะอุปกรณ์...' : 'Loading device status...'}
          error={error ?? undefined}
          onRetry={refresh}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label={lang === 'th' ? 'ยานพาหนะทั้งหมด' : 'Total Vehicles'}
              value={totals.total}
            />
            <KpiCard
              label={lang === 'th' ? 'ปกติ' : 'Healthy'}
              value={totals.healthy}
              subtitle={`${percent(totals.healthy, totals.total)} ${lang === 'th' ? 'ของทั้งหมด' : 'of fleet'}`}
              accentColor="#10B981"
            />
            <KpiCard
              label={lang === 'th' ? 'เตือน' : 'Warning'}
              value={totals.warning}
              subtitle={`${percent(totals.warning, totals.total)} ${lang === 'th' ? 'ของทั้งหมด' : 'of fleet'}`}
              accentColor="#F59E0B"
            />
            <KpiCard
              label={lang === 'th' ? 'ออฟไลน์' : 'Offline'}
              value={totals.offline}
              subtitle={`${percent(totals.offline, totals.total)} ${lang === 'th' ? 'ของทั้งหมด' : 'of fleet'}`}
              accentColor="#EF4444"
            />
            <KpiCard
              label={lang === 'th' ? 'ไม่ได้ติดตั้ง' : 'Not Installed'}
              value={totals.notInstalled}
              subtitle={`${percent(totals.notInstalled, totals.total)} ${lang === 'th' ? 'ของทั้งหมด' : 'of fleet'}`}
              accentColor="#9CA3AF"
            />
          </section>

          <section className={`${dashboardSectionClass} space-y-4`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {lang === 'th' ? 'ค้นหารถ' : 'Search Truck'}
                </label>
                <input
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder={lang === 'th' ? 'เช่น R001' : 'Search Truck (e.g. R001)'}
                  className={inputBase}
                />
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {lang === 'th' ? 'พื้นที่' : 'Region'}
                </label>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className={selectBase}
                >
                  <option value="">{lang === 'th' ? 'ทุกพื้นที่' : 'All Region'}</option>
                  {regionOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {lang === 'th' ? 'อุปกรณ์' : 'Device'}
                </label>
                <select
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value as DeviceFilterKey | '')}
                  className={selectBase}
                >
                  {DEVICE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.key || 'all'} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {lang === 'th' ? 'สถานะ' : 'Status'}
                </label>
                <select
                  value={statusSelect}
                  onChange={(e) => setStatusSelect(e.target.value as OverallStatus | '')}
                  className={selectBase}
                >
                  <option value="">{lang === 'th' ? 'ทุกสถานะ' : 'All Status'}</option>
                  {OVERALL_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'healthy' ? 'Healthy'
                        : s === 'warning' ? 'Warning'
                          : s === 'offline' ? 'Offline'
                            : 'Not Installed'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              {(
                [
                  ['healthy', 'Online', 'text-emerald-600'],
                  ['warning', 'Warning', 'text-amber-600'],
                  ['offline', 'Offline', 'text-red-600'],
                  ['not_installed', 'Not Installed', 'text-zinc-500'],
                ] as const
              ).map(([key, label, color]) => (
                <label key={key} className={`inline-flex items-center gap-2 ${color}`}>
                  <input
                    type="checkbox"
                    checked={statusChecks.has(key)}
                    onChange={() => toggleStatusCheck(key)}
                    className="rounded border-zinc-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className={tableHead}>
                  <tr>
                    <th className={tableHeadCell} rowSpan={2}>
                      {lang === 'th' ? 'รถ' : 'Truck'}
                    </th>
                    {['GPS', 'MCR', 'MDVR', 'IVMS', 'Fatigue AI', 'Intercom'].map((h) => (
                      <th key={h} className={`${tableHeadCell} text-center`} rowSpan={2}>{h}</th>
                    ))}
                    <th className={`${tableHeadCell} text-center`} colSpan={5}>
                      {lang === 'th' ? 'กล้อง' : 'Camera'}
                    </th>
                    <th className={tableHeadCell} rowSpan={2}>
                      {lang === 'th' ? 'รวม' : 'Overall'}
                    </th>
                    <th className={tableHeadCell} rowSpan={2}>
                      {lang === 'th' ? 'อัปเดต' : 'Updated'}
                    </th>
                    <th className={`${tableHeadCell} text-center`} rowSpan={2}>
                      {lang === 'th' ? 'ดู' : 'Action'}
                    </th>
                  </tr>
                  <tr>
                    {['C1', 'C2', 'C3', 'C4', 'C5'].map((h) => (
                      <th key={h} className={`${tableHeadCell} text-center`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className={`${tableCell} text-center text-zinc-500`}>
                        {lang === 'th' ? 'ไม่พบข้อมูล' : 'No vehicles match the current filters.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const ind = row.indicators;
                      const isOpen = expanded === row.vehicleNo;
                      return (
                        <Fragment key={row.vehicleNo}>
                          <tr className={tableRow}>
                            <td className={`${tableCell} font-semibold`} title={row.vehicleNo}>
                              {row.truckCode}
                            </td>
                            <td className={`${tableCell} text-center`}><StatusDot status={ind.gps} title="GPS" /></td>
                            <td className={`${tableCell} text-center`}><StatusDot status={ind.mcr} title="MCR" /></td>
                            <td className={`${tableCell} text-center`}><StatusDot status={ind.mdvr} title="MDVR" /></td>
                            <td className={`${tableCell} text-center`}><StatusDot status={ind.ivms} title="IVMS" /></td>
                            <td className={`${tableCell} text-center`}><StatusDot status={ind.fatigueAi} title="Fatigue AI" /></td>
                            <td className={`${tableCell} text-center`}><StatusDot status={ind.intercom} title="Intercom" /></td>
                            {([1, 2, 3, 4, 5] as const).map((ch) => (
                              <td key={ch} className={`${tableCell} text-center`}>
                                <StatusDot status={ind.cameras[ch]} title={`C${ch}`} />
                              </td>
                            ))}
                            <td className={tableCell}>
                              <OverallBadge status={ind.overall} lang={lang} />
                            </td>
                            <td className={`${tableCell} whitespace-nowrap text-zinc-500`}>
                              {formatRelativeUpdated(row.updatedAt, now, lang === 'th' ? 'th' : 'en')}
                            </td>
                            <td className={`${tableCell} text-center`}>
                              <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : row.vehicleNo)}
                                className="inline-flex rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
                                aria-label={lang === 'th' ? 'ดูรายละเอียด' : 'View details'}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="bg-zinc-50/80 dark:bg-zinc-900/40">
                              <td colSpan={14} className={`${tableCell} text-xs text-zinc-600 dark:text-zinc-400`}>
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                  {lang === 'th' ? 'รายละเอียด: ' : 'Details: '}
                                </span>
                                {row.details}
                                {row.location ? (
                                  <span className="ml-3 text-zinc-400">· {row.location}</span>
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Online
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Warning
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Offline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Not Installed
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-xs text-zinc-500">
                  {lang === 'th'
                    ? `แสดง ${(safePage - 1) * pageSize + (pageRows.length ? 1 : 0)} ถึง ${Math.min(safePage * pageSize, filteredRows.length)} จาก ${filteredRows.length} คัน`
                    : `Showing ${(safePage - 1) * pageSize + (pageRows.length ? 1 : 0)} to ${Math.min(safePage * pageSize, filteredRows.length)} of ${filteredRows.length} vehicles`}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className={`${selectBase} w-auto py-1.5 text-xs`}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={`${btnSecondary} px-2 py-1.5 text-xs disabled:opacity-40`}
                  >
                    ‹
                  </button>
                  <span className="px-2 text-xs tabular-nums text-zinc-600">
                    {safePage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className={`${btnSecondary} px-2 py-1.5 text-xs disabled:opacity-40`}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
