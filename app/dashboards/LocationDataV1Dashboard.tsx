'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { findValue, normalizeLabel, scopeFleetSet } from './dashboardDataUtils';
import {
  buildLocationContinuityGroups,
  normalizeLocationRows,
  summarizeLocationRecords,
  type LocationRecord,
} from './locationDataV1';
import LocationRouteOverview, { type LocationPlotPoint } from './LocationRouteOverview';
import LocationTelemetryTimeline, { type TelemetryPoint } from './LocationTelemetryTimeline';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import {
  isCompleteDateTimeRange,
  isDateInDateTimeRange,
  type DateTimeRange,
} from './dateTimeRange';
import { formatDateTimeGB } from './dateFormat';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import FilterBar from 'app/ui/FilterBar';
import MultiSelect from 'app/ui/MultiSelect';
import DateTimeRangePicker from 'app/ui/DateTimeRangePicker';
import ExportButton from 'app/ui/ExportButton';
import EmptyState from 'app/ui/EmptyState';
import { DataTable, type Column } from 'app/ui/DataTable';
import {
  badgeDefault,
  badgeInfo,
  badgeSuccess,
  badgeWarning,
  btnSecondary,
  btnSmall,
  heading2,
  inputBase,
  textMuted,
  textSecondary,
} from 'app/ui/design-tokens';

type LocationDataV1DashboardProps = {
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

type StoredLocationFilters = {
  search?: string;
  dateTimeRange?: DateTimeRange;
  vehicles?: string[];
  drivers?: string[];
  ignition?: string[];
  gpsStatuses?: string[];
  pollingModes?: string[];
};

type ExportLocationRow = Record<string, unknown> & {
  trackTime: string;
  vehicleNo: string;
  driverName: string;
  location: string;
  latitude: number | '';
  longitude: number | '';
  speedKph: number | '';
  ignition: string;
  gpsStatus: string;
  pollingMode: string;
  faceId: string;
  fuelbar: number | '';
  updatedTime: string;
  mapUrl: string;
};

type LocationTableRecord = LocationRecord & {
  trackTimestamp: number;
  updatedTimestamp: number;
};

const EMPTY_RANGE: DateTimeRange = { start: '', end: '' };
const FLEET_FIELD_ALIASES = ['Fleet', 'Fleet Name', 'Organization', 'Organization Name'];
const NORMALIZED_FLEET_FIELDS = new Set(FLEET_FIELD_ALIASES.map(normalizeLabel));

function formatDuration(milliseconds: number, lang: DashboardLang) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return lang === 'th'
      ? `${days} วัน ${hours} ชม.`
      : `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return lang === 'th'
      ? `${hours} ชม. ${minutes} นาที`
      : `${hours}h ${minutes}m`;
  }
  return lang === 'th' ? `${minutes} นาที` : `${minutes}m`;
}

function displayTime(record: LocationRecord, field: 'track' | 'updated') {
  const date = field === 'track' ? record.trackTime : record.updatedTime;
  const raw = field === 'track' ? record.trackTimeRaw : record.updatedTimeRaw;
  return date ? formatDateTimeGB(date) : raw || '—';
}

function displayVisualTime(record: LocationRecord) {
  return record.trackTime ? displayTime(record, 'track') : displayTime(record, 'updated');
}

function statusBadge(value: string, kind: 'gps' | 'ignition') {
  if (!value) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  if (kind === 'ignition') {
    const normalized = normalizeLabel(value);
    if (normalized === 'on' || normalized === 'acc on') return <span className={badgeSuccess}>{value}</span>;
    if (normalized === 'off' || normalized === 'acc off') return <span className={badgeWarning}>{value}</span>;
  }
  return <span className={kind === 'gps' ? badgeInfo : badgeDefault}>{value}</span>;
}

function exportRow(record: LocationRecord): ExportLocationRow {
  return {
    trackTime: record.trackTimeRaw,
    vehicleNo: record.vehicleNo,
    driverName: record.driverName,
    location: record.location,
    latitude: record.latitude ?? '',
    longitude: record.longitude ?? '',
    speedKph: record.speedKph ?? '',
    ignition: record.ignition,
    gpsStatus: record.gpsStatus,
    pollingMode: record.pollingMode,
    faceId: record.faceId,
    fuelbar: record.fuelbar ?? '',
    updatedTime: record.updatedTimeRaw,
    mapUrl: record.mapHref ?? '',
  };
}

export default function LocationDataV1Dashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  organizationNames,
  lang = 'en',
  isAdmin = false,
}: LocationDataV1DashboardProps) {
  const {
    rows,
    columns: sheetColumns,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = useGoogleSheet({ sheetId, gid: sheetGid });

  const storageKey = useMemo(() => `location-data-v1-${dashboardId}`, [dashboardId]);
  const [search, setSearch] = useState('');
  const [dateTimeRange, setDateTimeRange] = useState<DateTimeRange>(EMPTY_RANGE);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [ignition, setIgnition] = useState<string[]>([]);
  const [gpsStatuses, setGpsStatuses] = useState<string[]>([]);
  const [pollingModes, setPollingModes] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const didLoadStoredFilters = useRef(false);

  useEffect(() => {
    if (didLoadStoredFilters.current) return;
    didLoadStoredFilters.current = true;
    const stored = loadStoredFilters<StoredLocationFilters>(storageKey);
    if (!stored) return;
    const frame = requestAnimationFrame(() => {
      if (typeof stored.search === 'string') setSearch(stored.search);
      if (stored.dateTimeRange && isCompleteDateTimeRange(stored.dateTimeRange)) {
        setDateTimeRange(stored.dateTimeRange);
      }
      if (Array.isArray(stored.vehicles)) setVehicles(stored.vehicles.filter((value) => typeof value === 'string'));
      if (Array.isArray(stored.drivers)) setDrivers(stored.drivers.filter((value) => typeof value === 'string'));
      if (Array.isArray(stored.ignition)) setIgnition(stored.ignition.filter((value) => typeof value === 'string'));
      if (Array.isArray(stored.gpsStatuses)) setGpsStatuses(stored.gpsStatuses.filter((value) => typeof value === 'string'));
      if (Array.isArray(stored.pollingModes)) setPollingModes(stored.pollingModes.filter((value) => typeof value === 'string'));
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (!didLoadStoredFilters.current) return;
    saveStoredFilters(storageKey, {
      search,
      dateTimeRange,
      vehicles,
      drivers,
      ignition,
      gpsStatuses,
      pollingModes,
    });
  }, [dateTimeRange, drivers, gpsStatuses, ignition, pollingModes, search, storageKey, vehicles]);

  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const hasFleetColumn = useMemo(
    () => sheetColumns.some((column) => NORMALIZED_FLEET_FIELDS.has(normalizeLabel(column.label))),
    [sheetColumns],
  );
  const normalizedRecords = useMemo(() => normalizeLocationRows(rows), [rows]);
  const isDedicatedSingleVehicleSource = useMemo(() => {
    const vehicleIds = normalizedRecords.map((record) => normalizeLabel(record.vehicleNo));
    return (
      vehicleIds.length > 0 &&
      vehicleIds.every(Boolean) &&
      new Set(vehicleIds).size === 1
    );
  }, [normalizedRecords]);
  const scopeConfigurationError =
    !loading &&
    scopeSet.size > 0 &&
    !hasFleetColumn &&
    !isDedicatedSingleVehicleSource
      ? lang === 'th'
        ? 'แดชบอร์ดนี้จำกัดกลุ่มรถ แต่ชีตที่มีรถหลายคันไม่มีคอลัมน์ Fleet หรือ Organization'
        : 'This fleet-scoped dashboard has multiple or unidentified vehicles, but the sheet has no Fleet or Organization column.'
      : null;
  const records = useMemo(() => {
    if (scopeConfigurationError) return [];
    if (scopeSet.size === 0 || !hasFleetColumn) return normalizedRecords;
    return normalizedRecords.filter((record) => {
      const fleet = String(findValue(record.sourceRow, FLEET_FIELD_ALIASES) ?? '');
      return scopeSet.has(normalizeLabel(fleet));
    });
  }, [hasFleetColumn, normalizedRecords, scopeConfigurationError, scopeSet]);
  const vehicleOptions = useMemo(() => Array.from(new Set(records.map((record) => record.vehicleNo).filter(Boolean))).sort(), [records]);
  const driverOptions = useMemo(() => Array.from(new Set(records.map((record) => record.driverName).filter(Boolean))).sort(), [records]);
  const ignitionOptions = useMemo(() => Array.from(new Set(records.map((record) => record.ignition).filter(Boolean))).sort(), [records]);
  const gpsOptions = useMemo(() => Array.from(new Set(records.map((record) => record.gpsStatus).filter(Boolean))).sort(), [records]);
  const pollingOptions = useMemo(() => Array.from(new Set(records.map((record) => record.pollingMode).filter(Boolean))).sort(), [records]);

  const filteredRecords = useMemo(() => {
    const term = normalizeLabel(search);
    return records.filter((record) => {
      const filterTime = record.trackTime ?? record.updatedTime;
      if (
        isCompleteDateTimeRange(dateTimeRange) &&
        (!filterTime || !isDateInDateTimeRange(filterTime, dateTimeRange))
      ) {
        return false;
      }
      if (vehicles.length > 0 && !vehicles.includes(record.vehicleNo)) return false;
      if (drivers.length > 0 && !drivers.includes(record.driverName)) return false;
      if (ignition.length > 0 && !ignition.includes(record.ignition)) return false;
      if (gpsStatuses.length > 0 && !gpsStatuses.includes(record.gpsStatus)) return false;
      if (pollingModes.length > 0 && !pollingModes.includes(record.pollingMode)) return false;
      if (!term) return true;
      return normalizeLabel([
        record.trackTimeRaw,
        record.vehicleNo,
        record.driverName,
        record.location,
        record.ignition,
        record.gpsStatus,
        record.pollingMode,
        record.updatedTimeRaw,
        record.latitude,
        record.longitude,
      ].join(' ')).includes(term);
    });
  }, [dateTimeRange, drivers, gpsStatuses, ignition, pollingModes, records, search, vehicles]);

  const summary = useMemo(
    () => summarizeLocationRecords(filteredRecords, records),
    [filteredRecords, records],
  );
  const exportRows = useMemo(() => filteredRecords.map(exportRow), [filteredRecords]);
  const tableRecords = useMemo<LocationTableRecord[]>(() => filteredRecords.map((record) => ({
    ...record,
    trackTimestamp: record.trackTime?.getTime() ?? Number.NEGATIVE_INFINITY,
    updatedTimestamp: record.updatedTime?.getTime() ?? Number.NEGATIVE_INFINITY,
  })), [filteredRecords]);
  const routeGroups = useMemo(
    () => buildLocationContinuityGroups(records, filteredRecords, 'route'),
    [filteredRecords, records],
  );
  const telemetryGroups = useMemo(
    () => buildLocationContinuityGroups(records, filteredRecords, 'telemetry'),
    [filteredRecords, records],
  );
  const routePoints = useMemo<LocationPlotPoint[]>(() => filteredRecords.flatMap((record) => {
    if (record.latitude == null || record.longitude == null || !record.mapHref) return [];
    const timestamp = record.trackTime?.getTime() ?? record.updatedTime?.getTime();
    const segmentKey = routeGroups.get(record.sourceIndex);
    if (timestamp == null || !segmentKey) return [];
    return [{
      id: record.sourceIndex,
      segmentKey,
      vehicleNo: record.vehicleNo,
      latitude: record.latitude,
      longitude: record.longitude,
      location: record.location || `${record.latitude}, ${record.longitude}`,
      timestamp,
      timeLabel: displayVisualTime(record),
      speed: record.speedKph ?? 0,
      mapHref: record.mapHref,
    }];
  }), [filteredRecords, routeGroups]);
  const telemetryPoints = useMemo<TelemetryPoint[]>(() => filteredRecords.flatMap((record) => {
    const timestamp = record.trackTime?.getTime() ?? record.updatedTime?.getTime();
    const segmentKey = telemetryGroups.get(record.sourceIndex);
    if (timestamp == null || !segmentKey) return [];
    return [{
      id: record.sourceIndex,
      segmentKey,
      vehicleNo: record.vehicleNo,
      timestamp,
      speed: record.speedKph ?? 0,
      ignitionOn: record.ignitionOn,
    }];
  }), [filteredRecords, telemetryGroups]);

  const resolvedSelectedRecordId = routePoints.some((point) => point.id === selectedRecordId)
    ? selectedRecordId
    : routePoints[0]?.id ?? null;

  const activeFilterCount =
    (search ? 1 : 0) +
    (isCompleteDateTimeRange(dateTimeRange) ? 1 : 0) +
    vehicles.length +
    drivers.length +
    ignition.length +
    gpsStatuses.length +
    pollingModes.length;
  const copy = useMemo(() => lang === 'th'
    ? {
        subtitle: 'แดชบอร์ดติดตามตำแหน่ง',
        distance: 'ระยะทางโดยประมาณ',
        moving: 'เวลาเคลื่อนที่โดยประมาณ',
        maxSpeed: 'ความเร็วสูงสุด',
        records: 'บันทึกตำแหน่ง',
        movingSamples: 'จุดที่กำลังเคลื่อนที่',
        vehicles: 'รถ',
        drivers: 'คนขับ',
        locations: 'ตำแหน่ง',
        filters: 'ตัวกรองข้อมูลตำแหน่ง',
        filterDescription: 'กรองเส้นทาง กราฟ และประวัติพร้อมกัน',
        clear: 'ล้างตัวกรอง',
        search: 'ค้นหารถ คนขับ หรือตำแหน่ง',
        ignition: 'กุญแจ',
        gps: 'สถานะ GPS',
        polling: 'โหมดส่งข้อมูล',
        refresh: 'รีเฟรช',
        refreshing: 'กำลังรีเฟรช…',
        export: 'ส่งออก CSV',
        history: 'ประวัติตำแหน่ง',
        historyHint: 'แสดงข้อมูลล่าสุดสูงสุด 25,000 แถว คลิกแถวเพื่อเน้นจุดบนเส้นทาง',
        noData: 'ไม่พบข้อมูลตำแหน่ง',
        noDataDetail: 'ตรวจสอบลิงก์ชีตหรือลองล้างตัวกรอง',
        trackTime: 'เวลาติดตาม',
        vehicle: 'เลขรถ',
        driver: 'คนขับ',
        location: 'ตำแหน่ง',
        speed: 'ความเร็ว',
        updated: 'อัปเดตเมื่อ',
        map: 'แผนที่',
      }
    : {
        subtitle: 'Location tracking dashboard',
        distance: 'Approx. distance',
        moving: 'Estimated moving time',
        maxSpeed: 'Maximum speed',
        records: 'Location records',
        movingSamples: 'moving samples',
        vehicles: 'vehicles',
        drivers: 'drivers',
        locations: 'locations',
        filters: 'Location filters',
        filterDescription: 'Refine the route, timeline, KPIs, and audit trail together.',
        clear: 'Clear filters',
        search: 'Search vehicle, driver, or location',
        ignition: 'ignition states',
        gps: 'GPS statuses',
        polling: 'polling modes',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        export: 'Export CSV',
        history: 'Location history',
        historyHint: 'Showing up to 25,000 most recent source rows. Select a row to highlight its point on the route.',
        noData: 'No location records found',
        noDataDetail: 'Check the sheet link or clear the current filters.',
        trackTime: 'Track Time',
        vehicle: 'Vehicle No',
        driver: 'Driver Name',
        location: 'Location',
        speed: 'Speed',
        updated: 'Updated Time',
        map: 'Map',
      }, [lang]);

  const clearFilters = () => {
    setSearch('');
    setDateTimeRange(EMPTY_RANGE);
    setVehicles([]);
    setDrivers([]);
    setIgnition([]);
    setGpsStatuses([]);
    setPollingModes([]);
  };

  const tableColumns = useMemo<Column<LocationTableRecord>[]>(() => [
    {
      key: 'trackTimeRaw',
      sortKey: 'trackTimestamp',
      label: copy.trackTime,
      sortable: true,
      stickyLeft: true,
      render: (_value, record) => (
        <span className="block min-w-[8.5rem] whitespace-nowrap text-xs tabular-nums">
          {displayTime(record, 'track')}
        </span>
      ),
    },
    {
      key: 'vehicleNo',
      label: copy.vehicle,
      sortable: true,
      render: (_value, record) => record.vehicleNo ? (
        <span className="inline-flex rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/50">{record.vehicleNo}</span>
      ) : <span className="text-zinc-300">—</span>,
    },
    {
      key: 'driverName',
      label: copy.driver,
      sortable: true,
      render: (_value, record) => record.driverName || <span className="text-zinc-300">—</span>,
    },
    {
      key: 'location',
      label: copy.location,
      sortable: true,
      wrap: true,
      wrapClassName: 'min-w-[18rem] max-w-[28rem]',
      render: (_value, record) => (
        <span className="block">
          <span className="block text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{record.location || '—'}</span>
          {record.latitude != null && record.longitude != null ? (
            <span className="mt-1 block text-[10px] tabular-nums text-zinc-400">{record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'speedKph',
      label: `${copy.speed} (km/h)`,
      sortable: true,
      render: (_value, record) => {
        const speed = record.speedKph;
        if (speed == null) return <span className="text-zinc-300">—</span>;
        const className = speed > 60
          ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/50'
          : speed > 0
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/50'
            : 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700';
        return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ${className}`}>{speed.toLocaleString()}</span>;
      },
    },
    {
      key: 'ignition',
      label: lang === 'th' ? 'กุญแจ' : 'Ignition',
      sortable: true,
      render: (_value, record) => statusBadge(record.ignition, 'ignition'),
    },
    {
      key: 'gpsStatus',
      label: lang === 'th' ? 'สถานะ GPS' : 'GPS Status',
      sortable: true,
      render: (_value, record) => statusBadge(record.gpsStatus, 'gps'),
    },
    {
      key: 'pollingMode',
      label: lang === 'th' ? 'โหมดส่งข้อมูล' : 'Polling Mode',
      sortable: true,
      render: (_value, record) => record.pollingMode ? <span className={badgeDefault}>{record.pollingMode}</span> : <span className="text-zinc-300">—</span>,
    },
    {
      key: 'updatedTimeRaw',
      sortKey: 'updatedTimestamp',
      label: copy.updated,
      sortable: true,
      render: (_value, record) => <span className="whitespace-nowrap text-xs tabular-nums">{displayTime(record, 'updated')}</span>,
    },
    {
      key: 'mapHref',
      label: copy.map,
      render: (_value, record) => record.mapHref ? (
        <a
          href={record.mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
          aria-label={`${copy.map}: ${record.vehicleNo || record.location}`}
          title={copy.map}
          onClick={(event) => event.stopPropagation()}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.1 7-12a7 7 0 10-14 0c0 5.9 7 12 7 12z" />
            <circle cx="12" cy="9" r="2.2" />
          </svg>
        </a>
      ) : <span className="text-zinc-300">—</span>,
    },
  ], [copy, lang]);

  const actions = (
    <>
      <button type="button" onClick={refresh} disabled={refreshing} className={`${btnSecondary} ${btnSmall}`}>
        <svg aria-hidden="true" className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
        </svg>
        {refreshing ? copy.refreshing : copy.refresh}
      </button>
      <ExportButton
        data={exportRows}
        dashboardName={dashboardName}
        columns={[
          { key: 'trackTime', label: copy.trackTime },
          { key: 'vehicleNo', label: copy.vehicle },
          { key: 'driverName', label: copy.driver },
          { key: 'location', label: copy.location },
          { key: 'latitude', label: 'Latitude' },
          { key: 'longitude', label: 'Longitude' },
          { key: 'speedKph', label: `${copy.speed} (km/h)` },
          { key: 'ignition', label: lang === 'th' ? 'กุญแจ' : 'Ignition' },
          { key: 'gpsStatus', label: lang === 'th' ? 'สถานะ GPS' : 'GPS Status' },
          { key: 'pollingMode', label: lang === 'th' ? 'โหมดส่งข้อมูล' : 'Polling Mode' },
          { key: 'faceId', label: 'Face ID' },
          { key: 'fuelbar', label: 'Fuelbar' },
          { key: 'updatedTime', label: copy.updated },
          { key: 'mapUrl', label: 'Map URL' },
        ]}
        label={copy.export}
        lang={lang}
        settingsStorageKey={`location-data-v1-${dashboardId}`}
      />
    </>
  );

  const filterSummary = activeFilterCount > 0
    ? `${filteredRecords.length.toLocaleString()} / ${records.length.toLocaleString()} ${copy.records.toLocaleLowerCase()}`
    : `${records.length.toLocaleString()} ${copy.records.toLocaleLowerCase()}`;

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={copy.subtitle}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      actions={actions}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      activeFilterCount={activeFilterCount}
      filterSummary={filterSummary}
    >
      {loading || error || scopeConfigurationError ? (
        <LoadingState error={error ?? scopeConfigurationError ?? undefined} onRetry={refresh} lang={lang} />
      ) : records.length === 0 ? (
        <section className={dashboardSectionClass}>
          <EmptyState title={copy.noData} description={copy.noDataDetail} variant="dashboard" />
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label={lang === 'th' ? 'ตัวชี้วัดตำแหน่ง' : 'Location metrics'}>
            <KpiCard
              label={copy.distance}
              value={summary.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              unit="km"
              subtitle={`${summary.uniqueLocationCount.toLocaleString()} ${copy.locations}`}
              accentColor="#dc2626"
              tooltip={lang === 'th' ? 'คำนวณระยะทางระหว่างจุด GPS และไม่รวมช่วงที่ขาดหายหรือกระโดดผิดปกติ' : 'Calculated between GPS samples; long gaps and implausible jumps are excluded.'}
            />
            <KpiCard
              label={copy.moving}
              value={formatDuration(summary.movingDurationMs, lang)}
              subtitle={`${summary.movingRecordCount.toLocaleString()} ${copy.movingSamples}`}
              accentColor="#16a34a"
              tooltip={lang === 'th' ? 'ผลรวมของช่วงเวลาระหว่างจุดที่ความเร็วมากกว่าศูนย์' : 'Sum of valid sample intervals whose starting speed is above zero.'}
            />
            <KpiCard
              label={copy.maxSpeed}
              value={summary.maxSpeedKph.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              unit="km/h"
              subtitle={`${summary.averageSpeedKph.toLocaleString(undefined, { maximumFractionDigits: 1 })} km/h ${lang === 'th' ? 'เฉลี่ย' : 'average'}`}
              accentColor="#2563eb"
            />
            <KpiCard
              label={copy.records}
              value={summary.recordCount.toLocaleString()}
              subtitle={`${summary.uniqueVehicleCount.toLocaleString()} ${copy.vehicles} · ${summary.uniqueDriverCount.toLocaleString()} ${copy.drivers}`}
              accentColor="#7c3aed"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className={dashboardSectionClass}>
              <LocationRouteOverview points={routePoints} selectedId={resolvedSelectedRecordId} onSelect={setSelectedRecordId} lang={lang} />
            </div>
            <div className={dashboardSectionClass}>
              <LocationTelemetryTimeline points={telemetryPoints} lang={lang} />
            </div>
          </section>

          <FilterBar
            title={copy.filters}
            description={copy.filterDescription}
            activeCount={activeFilterCount}
            actions={activeFilterCount > 0 ? (
              <button type="button" onClick={clearFilters} className={`${btnSecondary} ${btnSmall}`}>
                {copy.clear}
              </button>
            ) : null}
          >
            <label className="min-w-[15rem] flex-[1.5]">
              <span className="sr-only">{copy.search}</span>
              <span className="relative block">
                <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="M20 20l-4-4" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.search}
                  className={`${inputBase} pl-9 text-xs`}
                />
              </span>
            </label>
            <DateTimeRangePicker value={dateTimeRange} onChange={setDateTimeRange} lang={lang} />
            <MultiSelect label={copy.vehicles} options={vehicleOptions} selected={vehicles} onChange={setVehicles} lang={lang} />
            <MultiSelect label={copy.drivers} options={driverOptions} selected={drivers} onChange={setDrivers} lang={lang} />
            <MultiSelect label={copy.ignition} options={ignitionOptions} selected={ignition} onChange={setIgnition} lang={lang} />
            <MultiSelect label={copy.gps} options={gpsOptions} selected={gpsStatuses} onChange={setGpsStatuses} lang={lang} />
            <MultiSelect label={copy.polling} options={pollingOptions} selected={pollingModes} onChange={setPollingModes} lang={lang} />
          </FilterBar>

          <section className={`${dashboardSectionClass} overflow-hidden p-0`} aria-labelledby="location-history-title">
            <div className="flex flex-col gap-2 border-b border-zinc-200/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800/70">
              <div>
                <h2 id="location-history-title" className={heading2}>{copy.history}</h2>
                <p className={`mt-1 ${textSecondary}`}>{copy.historyHint}</p>
              </div>
              <p className={textMuted} aria-live="polite">
                {filteredRecords.length.toLocaleString()} / {records.length.toLocaleString()} {copy.records.toLocaleLowerCase()}
              </p>
            </div>
            {filteredRecords.length > 0 ? (
              <DataTable
                columns={tableColumns}
                data={tableRecords}
                defaultSort={{ key: 'trackTimeRaw', direction: 'desc' }}
                onRowClick={(record) => setSelectedRecordId(record.sourceIndex)}
                ariaLabel={copy.history}
                pageSize={10}
              />
            ) : (
              <EmptyState title={copy.noData} description={copy.noDataDetail} />
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
