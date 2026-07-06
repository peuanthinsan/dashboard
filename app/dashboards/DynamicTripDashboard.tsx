'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import type { AlertRule } from './dashboardDataUtils';
import { DataTable, type Column } from 'app/ui/DataTable';
import {
  badgeDefault,
  btnSecondary,
  btnSmall,
  heading2,
  inputBase,
  selectBase,
  textMuted,
  textSecondary,
} from 'app/ui/design-tokens';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  alertRules?: AlertRule[] | null;
  isAdmin?: boolean;
};

const TRIP_COLUMNS = [
  { key: 'slNo', labels: ['SlNo', 'SINo', 'S.No', 'S No', 'No'] },
  { key: 'vehicleNo', labels: ['Vehicle No', 'VehicleNo', 'Vehicle'] },
  { key: 'startTime', labels: ['Start Time'] },
  { key: 'endTime', labels: ['End Time'] },
  { key: 'startLocation', labels: ['Start Location'] },
  { key: 'endLocation', labels: ['End Location'] },
  { key: 'startGeofenceType', labels: ['Start Geofence Type'] },
  { key: 'endGeofenceType', labels: ['End Geofence Type'] },
  { key: 'distance', labels: ['Distance'] },
  { key: 'duration', labels: ['Duration'] },
  { key: 'driveTime', labels: ['Drive Time'] },
  { key: 'idleTime', labels: ['Idle Time'] },
  { key: 'stopTime', labels: ['Stop Time'] },
  { key: 'restTime', labels: ['Rest Time'] },
  { key: 'overSpeed', labels: ['Over Speed', 'Overspeed'] },
  { key: 'maxSpeed', labels: ['Max Speed'] },
  { key: 'hb', labels: ['HB'] },
  { key: 'mapIt', labels: ['Map it', 'Map It', 'Map'] },
] as const;

type TripKey = (typeof TRIP_COLUMNS)[number]['key'];

type TripRow = {
  _id: number;
  slNo: number | '';
  vehicleNo: string;
  startTime: number | '';
  endTime: number | '';
  startTimeDisplay: string;
  endTimeDisplay: string;
  startLocation: string;
  endLocation: string;
  startGeofenceType: string;
  endGeofenceType: string;
  distance: number | '';
  duration: number | '';
  durationDisplay: string;
  driveTime: number | '';
  driveTimeDisplay: string;
  idleTime: number | '';
  idleTimeDisplay: string;
  stopTime: number | '';
  stopTimeDisplay: string;
  restTime: number | '';
  restTimeDisplay: string;
  overSpeed: number | '';
  maxSpeed: number | '';
  hb: number | '';
  mapIt: string;
  _lat?: number;
  _lng?: number;
  _mapHref?: string;
};

const PAGE_SIZE_OPTIONS: Array<{ value: number | 'all'; label: string }> = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 250, label: '250' },
  { value: 500, label: '500' },
  { value: 'all', label: 'All' },
];

const TH_LABELS: Record<TripKey, string> = {
  slNo: 'ลำดับ',
  vehicleNo: 'เลขรถ',
  startTime: 'เวลาเริ่ม',
  endTime: 'เวลาสิ้นสุด',
  startLocation: 'ตำแหน่งเริ่ม',
  endLocation: 'ตำแหน่งสิ้นสุด',
  startGeofenceType: 'ประเภท Geofence เริ่ม',
  endGeofenceType: 'ประเภท Geofence สิ้นสุด',
  distance: 'ระยะทาง',
  duration: 'ระยะเวลา',
  driveTime: 'เวลาขับ',
  idleTime: 'เวลาไม่เคลื่อนที่',
  stopTime: 'เวลาจอด',
  restTime: 'เวลาพัก',
  overSpeed: 'ความเร็วเกิน',
  maxSpeed: 'ความเร็วสูงสุด',
  hb: 'HB',
  mapIt: 'แผนที่',
};

const EN_LABELS: Record<TripKey, string> = {
  slNo: 'SlNo',
  vehicleNo: 'Vehicle No',
  startTime: 'Start Time',
  endTime: 'End Time',
  startLocation: 'Start Location',
  endLocation: 'End Location',
  startGeofenceType: 'Start Geofence Type',
  endGeofenceType: 'End Geofence Type',
  distance: 'Distance',
  duration: 'Duration',
  driveTime: 'Drive Time',
  idleTime: 'Idle Time',
  stopTime: 'Stop Time',
  restTime: 'Rest Time',
  overSpeed: 'Over Speed',
  maxSpeed: 'Max Speed',
  hb: 'HB',
  mapIt: 'Map it',
};

const DEFAULT_VISIBLE: Record<TripKey, boolean> = Object.fromEntries(
  TRIP_COLUMNS.map((c) => [c.key, true]),
) as Record<TripKey, boolean>;

const parseLatLng = (raw: unknown): { lat: number; lng: number } | null => {
  if (!raw) return null;
  const text = String(raw);
  const match = text.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (!match) return null;
  const lat = parseFloat(match[1]!);
  const lng = parseFloat(match[2]!);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
};

// "H:MM:SS" / "MM:SS" -> seconds
const durationToSeconds = (raw: string): number | '' => {
  if (!raw) return '';
  const parts = raw.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return '';
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return '';
};

const toNumberOrEmpty = (raw: string): number | '' => {
  if (!raw) return '';
  const n = Number(raw);
  return Number.isNaN(n) ? '' : n;
};

const formatDateTwoLine = (timestamp: number | '') => {
  if (timestamp === '') return null;
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString('en-GB'),
    time: d.toLocaleTimeString('en-GB'),
  };
};

const csvCellFor = (row: TripRow, key: TripKey): string => {
  switch (key) {
    case 'slNo':
      return row.slNo === '' ? '' : String(row.slNo);
    case 'vehicleNo':
      return row.vehicleNo;
    case 'startTime':
      return row.startTimeDisplay;
    case 'endTime':
      return row.endTimeDisplay;
    case 'startLocation':
      return row.startLocation;
    case 'endLocation':
      return row.endLocation;
    case 'startGeofenceType':
      return row.startGeofenceType;
    case 'endGeofenceType':
      return row.endGeofenceType;
    case 'distance':
      return row.distance === '' ? '' : String(row.distance);
    case 'duration':
      return row.durationDisplay;
    case 'driveTime':
      return row.driveTimeDisplay;
    case 'idleTime':
      return row.idleTimeDisplay;
    case 'stopTime':
      return row.stopTimeDisplay;
    case 'restTime':
      return row.restTimeDisplay;
    case 'overSpeed':
      return row.overSpeed === '' ? '' : String(row.overSpeed);
    case 'maxSpeed':
      return row.maxSpeed === '' ? '' : String(row.maxSpeed);
    case 'hb':
      return row.hb === '' ? '' : String(row.hb);
    case 'mapIt':
      return row._mapHref ?? row.mapIt;
  }
};

const escapeCsvCell = (value: string): string => {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const buildMapHref = (row: TripRow): string | null => {
  if (typeof row._lat === 'number' && typeof row._lng === 'number') {
    return `https://www.google.com/maps?q=${row._lat},${row._lng}`;
  }
  const query = row.endLocation || row.startLocation;
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

type PersistedState = {
  pageSize?: number | 'all';
  visibleCols?: Partial<Record<TripKey, boolean>>;
  search?: string;
};

export default function DynamicTripDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  lang = 'en',
  isAdmin = false,
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });

  const storageKey = useMemo(() => `dynamic-trip-${dashboardId}-v2`, [dashboardId]);

  const [pageSize, setPageSize] = useState<number | 'all'>(100);
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState<Record<TripKey, boolean>>(DEFAULT_VISIBLE);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const didLoad = useRef(false);
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    const stored = loadStoredFilters<PersistedState>(storageKey);
    if (!stored) return;
    if (stored.pageSize === 'all' || typeof stored.pageSize === 'number') setPageSize(stored.pageSize);
    if (typeof stored.search === 'string') setSearch(stored.search);
    if (stored.visibleCols && typeof stored.visibleCols === 'object') {
      setVisibleCols({ ...DEFAULT_VISIBLE, ...stored.visibleCols });
    }
  }, [storageKey]);

  useEffect(() => {
    if (!didLoad.current) return;
    saveStoredFilters(storageKey, { pageSize, visibleCols, search });
  }, [pageSize, visibleCols, search, storageKey]);

  const tripRows: TripRow[] = useMemo(() => {
    return rows.map((row, index) => {
      const fields: Record<string, string> = {};
      for (const col of TRIP_COLUMNS) {
        const value = findValue(row, [...col.labels]);
        fields[col.key] = value == null ? '' : String(value);
      }
      const startDate = parseDate(fields.startTime);
      const endDate = parseDate(fields.endTime);
      const latLng =
        parseLatLng(findValue(row, ['Latitude,Longitude', 'Lat,Lng', 'LatLng', 'Coordinates'])) ??
        parseLatLng(fields.mapIt);
      const trip: TripRow = {
        _id: index,
        slNo: toNumberOrEmpty(fields.slNo ?? ''),
        vehicleNo: fields.vehicleNo ?? '',
        startTime: startDate ? startDate.getTime() : '',
        endTime: endDate ? endDate.getTime() : '',
        startTimeDisplay: fields.startTime ?? '',
        endTimeDisplay: fields.endTime ?? '',
        startLocation: fields.startLocation ?? '',
        endLocation: fields.endLocation ?? '',
        startGeofenceType: fields.startGeofenceType ?? '',
        endGeofenceType: fields.endGeofenceType ?? '',
        distance: toNumberOrEmpty(fields.distance ?? ''),
        duration: durationToSeconds(fields.duration ?? ''),
        durationDisplay: fields.duration ?? '',
        driveTime: durationToSeconds(fields.driveTime ?? ''),
        driveTimeDisplay: fields.driveTime ?? '',
        idleTime: durationToSeconds(fields.idleTime ?? ''),
        idleTimeDisplay: fields.idleTime ?? '',
        stopTime: durationToSeconds(fields.stopTime ?? ''),
        stopTimeDisplay: fields.stopTime ?? '',
        restTime: durationToSeconds(fields.restTime ?? ''),
        restTimeDisplay: fields.restTime ?? '',
        overSpeed: toNumberOrEmpty(fields.overSpeed ?? ''),
        maxSpeed: toNumberOrEmpty(fields.maxSpeed ?? ''),
        hb: toNumberOrEmpty(fields.hb ?? ''),
        mapIt: fields.mapIt ?? '',
      };
      if (latLng) {
        trip._lat = latLng.lat;
        trip._lng = latLng.lng;
      }
      trip._mapHref = buildMapHref(trip) ?? undefined;
      return trip;
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = normalizeLabel(search);
    if (!term) return tripRows;
    return tripRows.filter((row) => {
      const haystack = [
        String(row.slNo),
        row.vehicleNo,
        row.startTimeDisplay,
        row.endTimeDisplay,
        row.startLocation,
        row.endLocation,
        row.startGeofenceType,
        row.endGeofenceType,
        String(row.distance),
        row.durationDisplay,
        row.driveTimeDisplay,
        row.idleTimeDisplay,
        row.stopTimeDisplay,
        row.restTimeDisplay,
        String(row.overSpeed),
        String(row.maxSpeed),
        String(row.hb),
      ].join(' ');
      return normalizeLabel(haystack).includes(term);
    });
  }, [tripRows, search]);

  const labels = lang === 'th' ? TH_LABELS : EN_LABELS;

  const activeFilterCount = search ? 1 : 0;
  const hiddenCount = TRIP_COLUMNS.length - TRIP_COLUMNS.filter((c) => visibleCols[c.key]).length;

  const columns: Column<TripRow>[] = useMemo(() => {
    const cellNumber = (v: unknown) => {
      if (v === '' || v == null) return <span className="text-zinc-300">—</span>;
      return <span className="tabular-nums">{String(v)}</span>;
    };
    const all: Column<TripRow>[] = [
      {
        key: 'slNo',
        label: labels.slNo,
        sortable: true,
        render: (_v, row) => (
          <span className="tabular-nums text-zinc-500">{row.slNo === '' ? '—' : row.slNo}</span>
        ),
      },
      {
        key: 'vehicleNo',
        label: labels.vehicleNo,
        sortable: true,
        render: (_v, row) =>
          row.vehicleNo ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/40">
              {row.vehicleNo}
            </span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'startTime',
        label: labels.startTime,
        sortable: true,
        render: (_v, row) => {
          const parts = formatDateTwoLine(row.startTime);
          if (!parts) return <span>{row.startTimeDisplay || '—'}</span>;
          return (
            <span className="whitespace-nowrap tabular-nums">
              {parts.date}
              <br />
              <span className="text-xs text-zinc-500">{parts.time}</span>
            </span>
          );
        },
      },
      {
        key: 'endTime',
        label: labels.endTime,
        sortable: true,
        render: (_v, row) => {
          const parts = formatDateTwoLine(row.endTime);
          if (!parts) return <span>{row.endTimeDisplay || '—'}</span>;
          return (
            <span className="whitespace-nowrap tabular-nums">
              {parts.date}
              <br />
              <span className="text-xs text-zinc-500">{parts.time}</span>
            </span>
          );
        },
      },
      {
        key: 'startLocation',
        label: labels.startLocation,
        sortable: true,
        wrap: true,
        render: (_v, row) =>
          row.startLocation ? (
            <span className="block max-w-[20rem] break-words text-xs text-zinc-600 dark:text-zinc-300">
              {row.startLocation}
            </span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'endLocation',
        label: labels.endLocation,
        sortable: true,
        wrap: true,
        render: (_v, row) =>
          row.endLocation ? (
            <span className="block max-w-[20rem] break-words text-xs text-zinc-600 dark:text-zinc-300">
              {row.endLocation}
            </span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'startGeofenceType',
        label: labels.startGeofenceType,
        sortable: true,
        render: (_v, row) =>
          row.startGeofenceType ? (
            <span className={badgeDefault}>{row.startGeofenceType}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'endGeofenceType',
        label: labels.endGeofenceType,
        sortable: true,
        render: (_v, row) =>
          row.endGeofenceType ? (
            <span className={badgeDefault}>{row.endGeofenceType}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      { key: 'distance', label: labels.distance, sortable: true, render: cellNumber },
      {
        key: 'duration',
        label: labels.duration,
        sortable: true,
        render: (_v, row) =>
          row.durationDisplay ? (
            <span className="tabular-nums">{row.durationDisplay}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'driveTime',
        label: labels.driveTime,
        sortable: true,
        render: (_v, row) =>
          row.driveTimeDisplay ? (
            <span className="tabular-nums">{row.driveTimeDisplay}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'idleTime',
        label: labels.idleTime,
        sortable: true,
        render: (_v, row) =>
          row.idleTimeDisplay ? (
            <span className="tabular-nums">{row.idleTimeDisplay}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'stopTime',
        label: labels.stopTime,
        sortable: true,
        render: (_v, row) =>
          row.stopTimeDisplay ? (
            <span className="tabular-nums">{row.stopTimeDisplay}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      {
        key: 'restTime',
        label: labels.restTime,
        sortable: true,
        render: (_v, row) =>
          row.restTimeDisplay ? (
            <span className="tabular-nums">{row.restTimeDisplay}</span>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
      { key: 'overSpeed', label: labels.overSpeed, sortable: true, render: cellNumber },
      {
        key: 'maxSpeed',
        label: labels.maxSpeed,
        sortable: true,
        render: (_v, row) => {
          if (row.maxSpeed === '') return <span className="text-zinc-300">—</span>;
          const high = row.maxSpeed >= 80;
          return (
            <span
              className={
                high
                  ? 'inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700 tabular-nums dark:bg-red-950/60 dark:text-red-300'
                  : 'tabular-nums'
              }
            >
              {row.maxSpeed}
            </span>
          );
        },
      },
      { key: 'hb', label: labels.hb, sortable: true, render: cellNumber },
      {
        key: 'mapIt',
        label: labels.mapIt,
        sortable: false,
        render: (_v, row) =>
          row._mapHref ? (
            <a
              href={row._mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm transition-all duration-150 hover:from-red-600 hover:to-red-700 hover:shadow"
              aria-label={lang === 'th' ? 'ดูบนแผนที่' : 'View on map'}
              title={lang === 'th' ? 'ดูบนแผนที่' : 'View on map'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              </svg>
            </a>
          ) : (
            <span className="text-zinc-300">—</span>
          ),
      },
    ];
    return all.filter((c) => visibleCols[c.key as TripKey]);
  }, [labels, lang, visibleCols]);

  const toggleColumn = (key: TripKey) => {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetColumns = () => setVisibleCols(DEFAULT_VISIBLE);

  const handleExportCsv = () => {
    const visibleKeys = TRIP_COLUMNS.map((c) => c.key).filter((k) => visibleCols[k]);
    const header = visibleKeys.map((k) => escapeCsvCell(labels[k])).join(',');
    const body = filteredRows
      .map((row) => visibleKeys.map((k) => escapeCsvCell(csvCellFor(row, k))).join(','))
      .join('\r\n');
    const csv = `﻿${header}\r\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = dashboardName.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'dashboard';
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    anchor.href = url;
    anchor.download = `${safeName}-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'สรุปข้อมูลทริปแบบไดนามิก' : 'Dynamic Trip Summary Data'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      activeFilterCount={activeFilterCount}
    >
      {loading || error ? (
        <LoadingState error={error ?? undefined} lang={lang} />
      ) : (
        <section className={dashboardSectionClass}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className={heading2}>
                {lang === 'th' ? 'สรุปข้อมูลทริปแบบไดนามิก' : 'Dynamic Trip Summary Data'}
              </h2>
              <p className={textSecondary}>
                {lang === 'th'
                  ? `${filteredRows.length} รายการ · คลิกเพื่อเรียงลำดับ · Shift+คลิก เพื่อเรียงหลายคอลัมน์`
                  : `${filteredRows.length} trips · click to sort · shift-click to chain multiple columns`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="shrink-0">{lang === 'th' ? 'แสดง' : 'Show'}</span>
                <select
                  value={String(pageSize)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setPageSize(raw === 'all' ? 'all' : Number(raw));
                  }}
                  className={`${selectBase} w-auto py-1.5 text-sm`}
                  aria-label={lang === 'th' ? 'จำนวนรายการต่อหน้า' : 'Entries per page'}
                >
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <option key={String(s.value)} value={String(s.value)}>
                      {s.value === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') : s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredRows.length === 0}
                className={`${btnSecondary} ${btnSmall}`}
                aria-label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
                title={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                {lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
              </button>
              <button
                type="button"
                onClick={() => setColumnsOpen((o) => !o)}
                className={`${btnSecondary} ${btnSmall}`}
                aria-expanded={columnsOpen}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {lang === 'th' ? 'คอลัมน์' : 'Columns'}
                {hiddenCount > 0 ? (
                  <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {hiddenCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block">
              <span className="sr-only">{lang === 'th' ? 'ค้นหา' : 'Search'}</span>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    lang === 'th'
                      ? 'ค้นหาเลขรถ, สถานที่, เวลา...'
                      : 'Search vehicle, location, time…'
                  }
                  className={`${inputBase} pl-9`}
                />
              </div>
            </label>
          </div>

          {columnsOpen ? (
            <div className="mb-4 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-2 flex items-center justify-between">
                <span className={textMuted}>
                  {lang === 'th' ? 'เลือกคอลัมน์ที่ต้องการแสดง' : 'Choose columns to show'}
                </span>
                <button
                  type="button"
                  onClick={resetColumns}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                {TRIP_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                    />
                    {labels[col.key]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {filteredRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              {lang === 'th' ? 'ไม่พบข้อมูล' : 'No data available'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200/80 dark:border-zinc-800">
              <DataTable
                columns={columns}
                data={filteredRows}
                defaultSort={{ key: 'startTime', direction: 'asc' }}
                pageSize={pageSize === 'all' ? undefined : pageSize}
                ariaLabel={lang === 'th' ? 'ตารางสรุปทริป' : 'Trip summary table'}
              />
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
