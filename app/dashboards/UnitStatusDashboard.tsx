'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import DateTimeRangePicker from 'app/ui/DateTimeRangePicker';
import KpiCard from 'app/ui/KpiCard';
import MultiSelect from 'app/ui/MultiSelect';
import {
  badgeDanger, badgeDefault, badgeSuccess, badgeWarning, btnSecondary, heading2,
  inputBase, labelBase, selectBase, tableCell, tableHead, tableHeadCell, tableRow,
} from 'app/ui/design-tokens';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { normalizeLabel, parseDate, scopeFleetSet } from './dashboardDataUtils';
import { formatDateTimeGB } from './dateFormat';
import { isCompleteDateTimeRange, isDateInDateTimeRange, type DateTimeRange } from './dateTimeRange';
import {
  buildInstallRows, buildUnitRows, DEVICE_FIELDS, hasUnitStatusColumns, isReportedValue,
  type UnitHealth, type UnitRow, type UnitUpdateStatus,
} from './unitStatusData';
import useUnitStatusSheet from './useUnitStatusSheet';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  companyName?: string | null;
  legacyBigthSource?: boolean;
  lang?: DashboardLang;
  isAdmin?: boolean;
};

const COPY = {
  en: {
    title: 'Unit status', units: 'Units', gpsOnline: 'GPS online', gpsOffline: 'GPS offline', attention: 'Needs attention',
    attentionNote: 'Units with at least one offline check', gpsUnknown: 'GPS status not reported',
    recent: 'Recent updates', stale: 'Stale updates', unknown: 'Unknown update time',
    recentBadge: 'Recent', staleBadge: 'Stale', unknownBadge: 'Unknown', online: 'Online', offline: 'Offline',
    autoRefresh: 'Auto-refresh', refresh: 'Refresh', refreshing: 'Refreshing…',
    search: 'Search units', placeholder: 'Vehicle number or location', updateStatus: 'Update status',
    all: 'All updates', reset: 'Reset', vehicle: 'Vehicle', update: 'Update', network: 'Network',
    storage: 'Storage', storageRaw: 'Reported storage', recording: 'Recording', videoLoss: 'Video loss', details: 'Details',
    show: 'View details', hide: 'Hide details', report: 'Last report', cameras: 'Cameras & storage',
    ai: 'AI alerts', aiStatus: 'AI', device: 'Device', cameraSetup: 'Camera setup', cameraSetupNote: 'Active / expected cameras',
    location: 'Location', speed: 'Speed', dataTime: 'Data time', gpsRaw: 'Reported GPS',
    direction: 'Direction', mainPower: 'Main power', battery: 'Battery', idKey: 'ID key last detected',
    storageAlert: 'Storage alert', storageAlertTime: 'Storage alert time', latestAi: 'Latest alert',
    aiTime: 'Alert time', notReported: 'Not reported', fleet: 'Fleet', driver: 'Driver', type: 'Type',
    fleets: 'fleets', vehicles: 'vehicles', drivers: 'drivers', types: 'types', dates: 'Report date & time',
    checklist: 'Device checklist', damage: 'Damage matrix', damageNote: 'Offline checks in the filtered units. Missing data is excluded.',
    installation: 'Fleet installation', installNote: 'Configured units and cameras across the dashboard fleet scope. Filters above do not change these totals.',
    cameraCount: 'Cameras', total: 'Total', installEmpty: 'No installation data reported.',
    unknownCameraUnits: (count: number) => `${count} ${count === 1 ? 'unit' : 'units'} with unknown camera counts`,
    metadataUnavailable: 'Camera setup and installation totals are unavailable.', metadataLoading: 'Loading camera setup and installation totals…',
    timeNote: 'Times shown in Bangkok time', intercomNote: 'Intercom is always Online because its data has no status trigger.',
    freshness: 'Updates older than 30 minutes are marked stale. Device statuses use the last report; missing data is Not reported.',
    empty: 'No units are available in this sheet for the dashboard scope.', noMatch: 'No units match the current filters.',
    loading: 'Loading unit status…', sourceError: 'This template needs vehicle number and GPS status or update time columns.',
    count: (shown: number, total: number) => `${shown} of ${total} units`,
  },
  th: {
    title: 'สถานะอุปกรณ์', units: 'รถทั้งหมด', gpsOnline: 'GPS ออนไลน์', gpsOffline: 'GPS ออฟไลน์', attention: 'ต้องตรวจสอบ',
    attentionNote: 'รถที่มีรายการตรวจสอบออฟไลน์อย่างน้อยหนึ่งรายการ', gpsUnknown: 'ไม่มีข้อมูลสถานะ GPS',
    recent: 'อัปเดตล่าสุด', stale: 'ข้อมูลเก่า', unknown: 'ไม่ทราบเวลาอัปเดต',
    recentBadge: 'ล่าสุด', staleBadge: 'ข้อมูลเก่า', unknownBadge: 'ไม่ทราบ', online: 'ออนไลน์', offline: 'ออฟไลน์',
    autoRefresh: 'รีเฟรชอัตโนมัติ', refresh: 'รีเฟรช', refreshing: 'กำลังรีเฟรช…',
    search: 'ค้นหารถ', placeholder: 'ทะเบียนรถหรือสถานที่', updateStatus: 'สถานะการอัปเดต',
    all: 'ทุกสถานะ', reset: 'ล้างตัวกรอง', vehicle: 'รถ', update: 'อัปเดต', network: 'เครือข่าย',
    storage: 'พื้นที่จัดเก็บ', storageRaw: 'ข้อมูลพื้นที่จัดเก็บ', recording: 'การบันทึก', videoLoss: 'วิดีโอขาดหาย', details: 'รายละเอียด',
    show: 'ดูรายละเอียด', hide: 'ซ่อนรายละเอียด', report: 'รายงานล่าสุด', cameras: 'กล้องและพื้นที่จัดเก็บ',
    ai: 'การแจ้งเตือน AI', aiStatus: 'AI', device: 'อุปกรณ์', cameraSetup: 'จำนวนกล้อง', cameraSetupNote: 'กล้องที่ทำงาน / กล้องที่ติดตั้ง',
    location: 'สถานที่', speed: 'ความเร็ว', dataTime: 'เวลาข้อมูล', gpsRaw: 'ข้อมูล GPS ที่รายงาน',
    direction: 'ทิศทาง', mainPower: 'ไฟเลี้ยงหลัก', battery: 'แบตเตอรี่', idKey: 'ตรวจพบ ID Key ล่าสุด',
    storageAlert: 'แจ้งเตือนพื้นที่จัดเก็บ', storageAlertTime: 'เวลาแจ้งเตือนพื้นที่จัดเก็บ', latestAi: 'แจ้งเตือนล่าสุด',
    aiTime: 'เวลาแจ้งเตือน', notReported: 'ไม่มีข้อมูลรายงาน', fleet: 'กลุ่มรถ', driver: 'คนขับ', type: 'ประเภท',
    fleets: 'กลุ่มรถ', vehicles: 'รถ', drivers: 'คนขับ', types: 'ประเภท', dates: 'วันที่และเวลารายงาน',
    checklist: 'รายการตรวจสอบอุปกรณ์', damage: 'สรุปอุปกรณ์ขัดข้อง', damageNote: 'จำนวนรายการออฟไลน์จากรถที่กรองไว้ ไม่นับรายการที่ไม่มีข้อมูล',
    installation: 'การติดตั้งตามกลุ่มรถ', installNote: 'รถและกล้องที่กำหนดไว้ในขอบเขตกลุ่มรถของแดชบอร์ด ตัวกรองด้านบนไม่เปลี่ยนยอดรวมนี้',
    cameraCount: 'กล้อง', total: 'รวม', installEmpty: 'ไม่มีข้อมูลการติดตั้ง',
    unknownCameraUnits: (count: number) => `${count} คันไม่มีข้อมูลจำนวนกล้อง`,
    metadataUnavailable: 'ไม่สามารถโหลดข้อมูลจำนวนกล้องและยอดรวมการติดตั้งได้', metadataLoading: 'กำลังโหลดข้อมูลจำนวนกล้องและยอดรวมการติดตั้ง…',
    timeNote: 'แสดงเวลาประเทศไทย', intercomNote: 'Intercom แสดงออนไลน์เสมอ เนื่องจากข้อมูลไม่มีเงื่อนไขแจ้งสถานะ',
    freshness: 'ข้อมูลที่อัปเดตเกิน 30 นาทีจะแสดงว่าข้อมูลเก่า สถานะอุปกรณ์อ้างอิงรายงานล่าสุด รายการที่ขาดจะแสดงว่าไม่มีข้อมูลรายงาน',
    empty: 'ไม่พบรถในชีตนี้ตามขอบเขตของแดชบอร์ด', noMatch: 'ไม่พบรถที่ตรงกับตัวกรอง',
    loading: 'กำลังโหลดสถานะอุปกรณ์…', sourceError: 'เทมเพลตนี้ต้องมีคอลัมน์ทะเบียนรถ และสถานะ GPS หรือเวลาอัปเดต',
    count: (shown: number, total: number) => `${shown} จาก ${total} คัน`,
  },
};

type Copy = typeof COPY.en;

function reported(value: string, copy: Copy) {
  return isReportedValue(value) ? value : copy.notReported;
}

function reportedTime(value: string, copy: Copy) {
  if (!isReportedValue(value)) return copy.notReported;
  const date = parseDate(value);
  return date ? formatDateTimeGB(date) : value;
}

function HealthBadge({ status, copy }: { status: UnitHealth; copy: Copy }) {
  const styles = { online: badgeSuccess, offline: badgeDanger, unknown: badgeDefault };
  const labels = { online: copy.online, offline: copy.offline, unknown: copy.notReported };
  return <span className={styles[status]}>{labels[status]}</span>;
}

function UpdateBadge({ status, copy }: { status: UnitUpdateStatus; copy: Copy }) {
  const styles = { recent: badgeSuccess, stale: badgeWarning, unknown: badgeDefault };
  const labels = { recent: copy.recentBadge, stale: copy.staleBadge, unknown: copy.unknownBadge };
  return <span className={styles[status]}>{labels[status]}</span>;
}

function CameraSetup({ row, copy }: { row: UnitRow; copy: Copy }) {
  if (row.expectedCameras == null) return <span className="text-zinc-500 dark:text-zinc-400">{copy.notReported}</span>;
  const complete = row.activeCameras >= row.expectedCameras;
  return <span className={complete ? badgeSuccess : badgeWarning} title={copy.cameraSetupNote}>{row.activeCameras}/{row.expectedCameras}</span>;
}

function DetailGroup({ title, fields }: { title: string; fields: [string, string][] }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <dl className="space-y-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
            <dt className="break-words text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="break-words text-zinc-700 dark:text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function UnitDetails({ row, copy, lang }: { row: UnitRow; copy: Copy; lang: DashboardLang }) {
  return (
    <div className="space-y-6 border-t border-zinc-200 px-1 py-6 dark:border-zinc-800">
      <section aria-label={copy.checklist}>
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.checklist}</h3>
        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {DEVICE_FIELDS.map((field) => (
            <div key={field.key} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
              <dt className="text-sm text-zinc-600 dark:text-zinc-300">{field[lang === 'th' ? 'th' : 'en']}</dt>
              <dd className="shrink-0"><HealthBadge status={row.statuses[field.key]} copy={copy} /></dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="grid gap-6 border-t border-zinc-200 pt-6 lg:grid-cols-3 lg:gap-8 dark:border-zinc-800">
        <DetailGroup title={copy.report} fields={[
          [copy.fleet, reported(row.fleet, copy)], [copy.driver, reported(row.driver, copy)],
          [copy.type, reported(row.type, copy)], [copy.location, reported(row.location, copy)],
          [copy.speed, isReportedValue(row.speed) ? `${row.speed} km/h` : copy.notReported],
          [copy.dataTime, reportedTime(row.dataTime, copy)], [copy.gpsRaw, reported(row.gps, copy)],
          [copy.network, reported(row.network, copy)], [copy.direction, reported(row.direction, copy)],
          ['HDOP', reported(row.hdop, copy)], [copy.mainPower, reported(row.mainPower, copy)],
          [copy.battery, reported(row.battery, copy)], [copy.idKey, reportedTime(row.idKeyLastDetected, copy)],
        ]} />
        <DetailGroup title={copy.cameras} fields={[
          [copy.storageRaw, reported(row.storageRaw, copy)], [copy.recording, reported(row.recording, copy)],
          [copy.videoLoss, reported(row.videoLoss, copy)], [copy.storageAlert, reported(row.storageAlert, copy)],
          [copy.storageAlertTime, reportedTime(row.storageAlertTime, copy)],
        ]} />
        <DetailGroup title={copy.ai} fields={[
          [copy.latestAi, reported(row.lastAiAlert, copy)], [copy.aiTime, reportedTime(row.lastAiAlertTime, copy)],
        ]} />
      </div>
    </div>
  );
}

function optionsFor(units: UnitRow[], key: 'vehicleNo' | 'fleet' | 'driver' | 'type') {
  return Array.from(new Set(units.map((row) => row[key]).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}

function unitKey(row: UnitRow) {
  return JSON.stringify([normalizeLabel(row.fleet), normalizeLabel(row.vehicleNo)]);
}

export default function UnitStatusDashboard({
  dashboardId, dashboardName, sheetId, sheetGid, dashboardNotes, organizationName,
  organizationNames, companyName, legacyBigthSource = false, lang = 'en', isAdmin = false,
}: DashboardProps) {
  const copy = COPY[lang === 'th' ? 'th' : 'en'];
  const primary = useUnitStatusSheet({ sheetId, ...(legacyBigthSource ? { tabName: 'Unitstatus' } : { gid: sheetGid }) });
  const channelSheet = useUnitStatusSheet({ sheetId, tabName: 'CH' });
  const { columns, rows, loading, error, lastUpdated } = primary;
  const refreshPrimary = primary.refresh;
  const refreshChannels = channelSheet.refresh;
  const refreshing = primary.refreshing || channelSheet.refreshing;
  const refresh = useCallback(() => { refreshPrimary(); refreshChannels(); }, [refreshPrimary, refreshChannels]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UnitUpdateStatus | ''>('');
  const [dateTimeRange, setDateTimeRange] = useState<DateTimeRange>({ start: '', end: '' });
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scopeSet = useMemo(() => scopeFleetSet(organizationName, organizationNames), [organizationName, organizationNames]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  const units = useMemo(() => buildUnitRows(rows, channelSheet.rows, scopeSet, now, companyName), [rows, channelSheet.rows, scopeSet, now, companyName]);
  const options = useMemo(() => ({
    fleets: optionsFor(units, 'fleet'), vehicles: optionsFor(units, 'vehicleNo'),
    drivers: optionsFor(units, 'driver'), types: optionsFor(units, 'type'),
  }), [units]);
  const filtered = useMemo(() => {
    const query = normalizeLabel(search);
    const fleets = new Set(fleetFilters.map(normalizeLabel));
    return units.filter((row) => (!status || row.updateStatus === status)
      && (!query || normalizeLabel(`${row.vehicleNo} ${row.location}`).includes(query))
      && (!isCompleteDateTimeRange(dateTimeRange) || isDateInDateTimeRange(row.updatedAt, dateTimeRange))
      && (fleets.size === 0 || fleets.has(normalizeLabel(row.fleet)))
      && (vehicleFilters.length === 0 || vehicleFilters.includes(row.vehicleNo))
      && (driverFilters.length === 0 || driverFilters.includes(row.driver))
      && (typeFilters.length === 0 || typeFilters.includes(row.type)));
  }, [units, search, status, dateTimeRange, fleetFilters, vehicleFilters, driverFilters, typeFilters]);
  const installRows = useMemo(() => buildInstallRows(channelSheet.rows, units, scopeSet), [channelSheet.rows, units, scopeSet]);
  const installTotals = installRows.reduce((total, row) => ({
    vehicles: total.vehicles + row.vehicles, cameras: total.cameras + row.cameras,
    unknownCameraUnits: total.unknownCameraUnits + row.unknownCameraUnits,
  }), { vehicles: 0, cameras: 0, unknownCameraUnits: 0 });
  const damageCounts = useMemo(() => DEVICE_FIELDS.filter((field) => field.key !== 'gpsStatus')
    .map((field) => ({ ...field, count: filtered.filter((row) => row.statuses[field.key] === 'offline').length }))
    .sort((a, b) => b.count - a.count), [filtered]);
  const selected = filtered.find((row) => unitKey(row) === expanded);
  const gpsUnknown = filtered.filter((row) => row.statuses.gpsStatus === 'unknown').length;
  const activeFilterCount = Number(Boolean(search.trim())) + Number(Boolean(status)) + Number(isCompleteDateTimeRange(dateTimeRange))
    + fleetFilters.length + vehicleFilters.length + driverFilters.length + typeFilters.length;
  const invalidSource = columns.length > 0 && !hasUnitStatusColumns(columns);
  const reset = () => {
    setSearch(''); setStatus(''); setExpanded(null); setDateTimeRange({ start: '', end: '' });
    setFleetFilters([]); setVehicleFilters([]); setDriverFilters([]); setTypeFilters([]);
  };
  // The shell formats UTC digits; convert the fetch instant to Bangkok digits.
  const checkedAt = lastUpdated ? new Date(lastUpdated.getTime() + 7 * 60 * 60 * 1_000) : null;

  return (
    <DashboardShell title={dashboardName} subtitle={copy.title} lang={lang}
      dashboardId={dashboardId} isAdmin={isAdmin} notes={dashboardNotes} lastUpdated={checkedAt}
      activeFilterCount={activeFilterCount} actions={<>
        <label className="inline-flex min-h-10 items-center gap-2 px-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="h-4 w-4 accent-red-600" />
          {copy.autoRefresh}
        </label>
        <button type="button" className={btnSecondary} onClick={refresh} disabled={loading || refreshing}>
          <svg aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.5 9A7 7 0 0119.07 8M18.5 15A7 7 0 014.93 16" />
          </svg>
          {refreshing ? copy.refreshing : copy.refresh}
        </button>
      </>}
    >
      {loading || error || invalidSource ? (
        <LoadingState lang={lang} message={copy.loading} error={error ?? (invalidSource ? copy.sourceError : undefined)} onRetry={refresh} />
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label={copy.title}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={copy.units} value={filtered.length} />
              <KpiCard label={copy.gpsOnline} value={filtered.filter((row) => row.statuses.gpsStatus === 'online').length} accentColor="#10b981" />
              <KpiCard label={copy.gpsOffline} value={filtered.filter((row) => row.statuses.gpsStatus === 'offline').length} accentColor="#ef4444" />
              <KpiCard label={copy.attention} value={filtered.filter((row) => DEVICE_FIELDS.some((field) => row.statuses[field.key] === 'offline')).length} accentColor="#f59e0b" tooltip={copy.attentionNote} />
            </div>
            {gpsUnknown > 0 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{copy.gpsUnknown}: {gpsUnknown}</p>}
          </section>

          <section className={`${dashboardSectionClass} relative z-20 space-y-4`} aria-label={copy.search} data-print-hide>
            <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
              <div className="min-w-0">
                <label htmlFor="unit-status-search" className={`${labelBase} mb-2`}>{copy.search}</label>
                <input id="unit-status-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.placeholder} className={inputBase} />
              </div>
              <div className="min-w-0">
                <p className={`${labelBase} mb-2`}>{copy.dates}</p>
                <DateTimeRangePicker value={dateTimeRange} onChange={setDateTimeRange} lang={lang} className="w-full" />
              </div>
              <div className="min-w-0">
                <label htmlFor="unit-status-update" className={`${labelBase} mb-2`}>{copy.updateStatus}</label>
                <select id="unit-status-update" value={status} onChange={(event) => setStatus(event.target.value as UnitUpdateStatus | '')} className={selectBase}>
                  <option value="">{copy.all}</option><option value="recent">{copy.recent}</option>
                  <option value="stale">{copy.stale}</option><option value="unknown">{copy.unknown}</option>
                </select>
              </div>
              <button type="button" onClick={reset} className={btnSecondary}>{copy.reset}</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div role="group" aria-label={copy.fleet}><p className={`${labelBase} mb-2`}>{copy.fleet}</p><MultiSelect label={copy.fleets} options={options.fleets} selected={fleetFilters} onChange={setFleetFilters} lang={lang} /></div>
              <div role="group" aria-label={copy.vehicle}><p className={`${labelBase} mb-2`}>{copy.vehicle}</p><MultiSelect label={copy.vehicles} options={options.vehicles} selected={vehicleFilters} onChange={setVehicleFilters} lang={lang} /></div>
              <div role="group" aria-label={copy.driver}><p className={`${labelBase} mb-2`}>{copy.driver}</p><MultiSelect label={copy.drivers} options={options.drivers} selected={driverFilters} onChange={setDriverFilters} lang={lang} /></div>
              <div role="group" aria-label={copy.type}><p className={`${labelBase} mb-2`}>{copy.type}</p><MultiSelect label={copy.types} options={options.types} selected={typeFilters} onChange={setTypeFilters} lang={lang} /></div>
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={heading2}>{copy.title}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.freshness}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{copy.intercomNote}</p>
              </div>
              <p className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400" aria-live="polite">{copy.count(filtered.length, units.length)}</p>
            </div>
            {(channelSheet.error || channelSheet.loading) && <p role="status" className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{channelSheet.error ? copy.metadataUnavailable : copy.metadataLoading}</p>}
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800" tabIndex={0} role="region" aria-label={copy.title}>
              <table className="w-full min-w-[1120px] text-sm">
                <thead className={tableHead}>
                  <tr>{[copy.vehicle, copy.update, 'GPS', copy.aiStatus, copy.device, copy.storage, copy.cameraSetup, 'Intercom', copy.details].map((label) => <th key={label} scope="col" className={tableHeadCell}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={unitKey(row)} className={`${tableRow} ${expanded === unitKey(row) ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}`}>
                      <th scope="row" className={`${tableCell} text-left`}>
                        <span className="block font-semibold text-zinc-950 dark:text-zinc-100">{row.vehicleNo}</span>
                        <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">{reported(row.fleet || row.deviceType, copy)}</span>
                      </th>
                      <td className={tableCell}>
                        <UpdateBadge status={row.updateStatus} copy={copy} />
                        <span className="mt-1 block whitespace-nowrap text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{reportedTime(row.updatedRaw, copy)}</span>
                      </td>
                      <td className={tableCell}><HealthBadge status={row.statuses.gpsStatus} copy={copy} /></td>
                      <td className={tableCell}><HealthBadge status={row.statuses.statusAi} copy={copy} /></td>
                      <td className={tableCell}><HealthBadge status={row.statuses.deviceStatus} copy={copy} /></td>
                      <td className={tableCell}><HealthBadge status={row.statuses.storage} copy={copy} /></td>
                      <td className={tableCell}><CameraSetup row={row} copy={copy} /></td>
                      <td className={tableCell}><HealthBadge status={row.statuses.intercom} copy={copy} /></td>
                      <td className={tableCell}>
                        <button type="button" className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950/30"
                          aria-expanded={expanded === unitKey(row)} aria-controls="unit-status-details"
                          aria-label={`${expanded === unitKey(row) ? copy.hide : copy.show}: ${row.vehicleNo}${row.fleet ? ` · ${row.fleet}` : ''}`}
                          onClick={() => setExpanded(expanded === unitKey(row) ? null : unitKey(row))}>
                          {expanded === unitKey(row) ? copy.hide : copy.show}
                          <svg aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded === unitKey(row) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={9} className={`${tableCell} py-12 text-center text-zinc-500`}>{units.length ? copy.noMatch : copy.empty}</td></tr>}
                </tbody>
              </table>
            </div>
            <div id="unit-status-details" role="region" aria-label={selected ? `${copy.details}: ${selected.vehicleNo}` : copy.details}>
              {selected && <><p className="mt-6 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selected.vehicleNo}</p><UnitDetails row={selected} copy={copy} lang={lang} /></>}
            </div>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{copy.cameraSetupNote} · {copy.timeNote}</p>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{copy.damage}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.damageNote}</p>
              <dl className="mt-5 grid gap-2 sm:grid-cols-2">
                {damageCounts.map((field) => <div key={field.key} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                  <dt className="text-sm text-zinc-600 dark:text-zinc-300">{field[lang === 'th' ? 'th' : 'en']}</dt>
                  <dd className={`text-sm font-semibold tabular-nums ${field.count ? 'text-red-600 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'}`}>{field.count}</dd>
                </div>)}
              </dl>
            </section>
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{copy.installation}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.installNote}</p>
              {channelSheet.error || channelSheet.loading ? <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">{channelSheet.error ? copy.metadataUnavailable : copy.metadataLoading}</p> : (
                <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className={tableHead}><tr>{[copy.fleet, copy.units, copy.cameraCount].map((label) => <th key={label} scope="col" className={tableHeadCell}>{label}</th>)}</tr></thead>
                    <tbody>
                      {installRows.map((row) => <tr key={row.fleet} className={tableRow}><th scope="row" className={`${tableCell} text-left font-medium`}>{row.fleet}</th><td className={`${tableCell} tabular-nums`}>{row.vehicles}</td><td className={`${tableCell} tabular-nums`}>{row.cameras}{row.unknownCameraUnits > 0 && <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">{copy.unknownCameraUnits(row.unknownCameraUnits)}</span>}</td></tr>)}
                      {installRows.length === 0 && <tr><td colSpan={3} className={`${tableCell} py-8 text-center text-zinc-500`}>{copy.installEmpty}</td></tr>}
                    </tbody>
                    {installRows.length > 0 && <tfoot><tr className="border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-900"><th scope="row" className={`${tableCell} text-left`}>{copy.total}</th><td className={`${tableCell} tabular-nums`}>{installTotals.vehicles}</td><td className={`${tableCell} tabular-nums`}>{installTotals.cameras}{installTotals.unknownCameraUnits > 0 && <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">{copy.unknownCameraUnits(installTotals.unknownCameraUnits)}</span>}</td></tr></tfoot>}
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
