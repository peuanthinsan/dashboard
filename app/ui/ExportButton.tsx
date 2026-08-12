'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from 'app/hooks/useFocusTrap';
import { escapeCsvField } from 'app/ui/csvEscape';
import {
  loadCsvExportPrefs,
  saveCsvExportPrefs,
  type StoredColumnPref,
} from 'app/ui/csvExportPrefsStorage';
import {
  moveColumn,
  moveColumnTo,
  placeDriverNameBeforeId,
  shouldUseSavedColumnPrefs,
} from 'app/ui/csvExportSchema';
import {
  type TimeFormatId,
  formatExportCellValue,
  timeFormatOptions,
} from 'app/ui/exportCsvFormat';
import {
  CSV_JOIN_WORKER_LINE_THRESHOLD,
  joinCsvLinesInWorker,
} from 'app/ui/joinCsvLinesInWorker';

export type ExportColumnDef = { key: string; label: string };

export type FullSheetExportSource = {
  rows: Record<string, unknown>[];
  filteredRows?: Record<string, unknown>[];
  columns: { label: string; type: string; fieldKey?: string }[];
};

type ColumnState = ExportColumnDef & { enabled: boolean };

type ExportButtonProps = {
  data: Record<string, unknown>[];
  /** Raw sheet rows + column metadata (order and types). Enables “all spreadsheet columns” export. */
  fullSheetExport?: FullSheetExportSource | null;
  /** Legacy direct filename (used as-is when dashboardName/dateRange are not provided). */
  filename?: string;
  /** Dashboard name included in the generated filename, e.g. "SummaryDashboard". */
  dashboardName?: string;
  /**
   * Date range string included in the generated filename, e.g. "2026-03" or "2026-01_2026-03".
   * Accepts any string; special characters are sanitised before use.
   */
  dateRange?: string;
  /** Default column keys, order, and header labels. If omitted, keys come from the first data row. */
  columns?: ExportColumnDef[];
  label?: string;
  /** Persist column visibility and header labels under this key (localStorage). Defaults to dashboardName or filename. */
  settingsStorageKey?: string;
  lang?: 'en' | 'th';
  /**
   * Optional note under “all spreadsheet columns” (e.g. aggregated dashboards where full sheet is raw rows).
   * When omitted, the default hint is used.
   */
  fullSheetHint?: string;
};

const DEFAULT_TIME_FORMAT: TimeFormatId = 'as_is';

function buildFilename(filename?: string, dashboardName?: string, dateRange?: string): string {
  if (dashboardName || dateRange) {
    const parts: string[] = [];
    if (dashboardName) parts.push(dashboardName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (dateRange) parts.push(dateRange.replace(/[^a-zA-Z0-9_-]/g, '_'));
    return parts.join('_') || 'export';
  }
  return filename ?? 'export';
}

function schemaFromProps(
  columns: ExportColumnDef[] | undefined,
  data: Record<string, unknown>[],
): ExportColumnDef[] {
  if (columns?.length) return columns;
  if (data.length === 0) return [];
  return Object.keys(data[0]).map((key) => ({ key, label: key }));
}

function schemaFromFullSheet(source: FullSheetExportSource): ExportColumnDef[] {
  return placeDriverNameBeforeId(source.columns.map((c) => ({ key: c.fieldKey ?? c.label, label: c.label })));
}

function columnTypeMapFromFullSheet(source: FullSheetExportSource): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of source.columns) {
    m.set(c.fieldKey ?? c.label, c.type);
  }
  return m;
}

function mergeSchemaWithSaved(schema: ExportColumnDef[], saved: StoredColumnPref[] | null): ColumnState[] {
  if (!saved?.length) {
    return schema.map((c) => ({ ...c, enabled: true }));
  }
  const schemaKeys = new Set(schema.map((c) => c.key));
  const used = new Set<string>();
  const out: ColumnState[] = [];

  for (const s of saved) {
    if (!schemaKeys.has(s.key) || used.has(s.key)) continue;
    const def = schema.find((c) => c.key === s.key)!;
    out.push({
      key: s.key,
      label: typeof s.label === 'string' && s.label.length > 0 ? s.label : def.label,
      enabled: Boolean(s.enabled),
    });
    used.add(s.key);
  }

  for (const c of schema) {
    if (!used.has(c.key)) {
      out.push({ ...c, enabled: true });
    }
  }

  return out;
}

const CSV_ROW_CHUNK = 2500;

/** Yields between chunks so the main thread can paint (large exports). */
async function buildCsvFromStatesAsync(
  rows: Record<string, unknown>[],
  columnStates: ColumnState[],
  timeFormat: TimeFormatId,
  columnTypesByKey: Map<string, string> | undefined,
): Promise<string> {
  const active = columnStates.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.label }));
  if (active.length === 0) return '';
  const header = active.map((c) => escapeCsvField(c.label)).join(',');
  const lines: string[] = [header];
  for (let start = 0; start < rows.length; start += CSV_ROW_CHUNK) {
    if (start > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const end = Math.min(start + CSV_ROW_CHUNK, rows.length);
    for (let i = start; i < end; i++) {
      const row = rows[i]!;
      lines.push(
        active
          .map((c) => {
            const val = row[c.key];
            const str = formatExportCellValue(val, timeFormat, {
              columnType: columnTypesByKey?.get(c.key),
              fieldKey: c.key,
            });
            return escapeCsvField(str);
          })
          .join(','),
      );
    }
  }
  if (typeof Worker !== 'undefined' && lines.length >= CSV_JOIN_WORKER_LINE_THRESHOLD) {
    return joinCsvLinesInWorker(lines);
  }
  return lines.join('\n');
}

function downloadCsv(csv: string, fileBase: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyForLang(lang: 'en' | 'th') {
  if (lang === 'th') {
    return {
      modalTitle: 'ตั้งค่าการส่งออก CSV',
      modalDescription: 'เลือกคอลัมน์ รูปแบบเวลา และแหล่งข้อมูล',
      fieldKey: 'ฟิลด์',
      headerLabel: 'หัวคอลัมน์ในไฟล์',
      selectAll: 'เลือกทั้งหมด',
      deselectAll: 'ไม่เลือก',
      reorder: 'เรียงลำดับ',
      dragToReorder: 'ลากเพื่อเรียงลำดับ',
      dropToReorder: 'วางเพื่อย้ายคอลัมน์',
      moveUp: 'เลื่อนขึ้น',
      moveDown: 'เลื่อนลง',
      cancel: 'ยกเลิก',
      download: 'ดาวน์โหลด CSV',
      preparingCsv: 'กำลังเตรียม CSV…',
      needOneColumn: 'ต้องเลือกอย่างน้อยหนึ่งคอลัมน์',
      dataSourceLegend: 'ข้อมูลที่ส่งออก',
      dataSourceDashboard: 'ข้อมูลบนแดชบอร์ด (ผ่านตัวกรอง)',
      dataSourceFullSheet: 'ทุกคอลัมน์จากสเปรดชีต (ทั้งแท็บ)',
      dataSourceFullHint: 'ใช้แถวที่กรองอยู่ในแดชบอร์ด แต่ดึงทุกคอลัมน์จากชีต',
      timeFormatLegend: 'รูปแบบวันเวลา',
      timeFormatHint:
        'ใช้กับคอลัมน์วันที่/เวลาจากชีต และคอลัมน์ที่ชื่อเกี่ยวกับวันที่หรือเวลาในมุมมองแดชบอร์ด',
      prefsLoadParse:
        'อ่านการตั้งค่าที่บันทึกไว้ไม่ได้ (ข้อมูลเสียหาย) — ใช้ค่าเริ่มต้นแทน',
      prefsLoadVersion: 'การตั้งค่าที่บันทึกไว้รูปแบบไม่รองรับ — ใช้ค่าเริ่มต้นแทน',
      prefsSaveQuota:
        'บันทึกการตั้งค่าไม่ได้ (ที่เก็บเต็มหรือถูกบล็อก) — ดาวน์โหลดยังไม่เริ่ม ลองปิดแท็บอื่นหรือล้างข้อมูลไซต์',
      prefsSaveUnknown:
        'บันทึกการตั้งค่าไม่สำเร็จ — ดาวน์โหลดยังไม่เริ่ม ลองอีกครั้งหรือตรวจสอบการตั้งค่าเบราว์เซอร์',
    };
  }
  return {
    modalTitle: 'Configure CSV export',
    modalDescription: 'Choose data source, columns, and how dates and times are written.',
    fieldKey: 'Field',
    headerLabel: 'CSV header',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    reorder: 'Reorder',
    dragToReorder: 'Drag to reorder',
    dropToReorder: 'Drop to move column',
    moveUp: 'Move up',
    moveDown: 'Move down',
    cancel: 'Cancel',
    download: 'Download CSV',
    preparingCsv: 'Preparing CSV…',
    needOneColumn: 'Select at least one column.',
    dataSourceLegend: 'Data to export',
    dataSourceDashboard: 'Dashboard view (respects filters)',
    dataSourceFullSheet: 'All spreadsheet columns (full tab)',
    dataSourceFullHint: 'Uses the currently filtered dashboard rows, but includes all sheet columns.',
    timeFormatLegend: 'Date & time format',
    timeFormatHint:
      'Applied to sheet date/datetime columns and dashboard columns whose names suggest date or time.',
    prefsLoadParse:
      'Could not read saved export settings (data was corrupted). Defaults are being used.',
    prefsLoadVersion: 'Saved export settings used an unsupported format. Defaults are being used.',
    prefsSaveQuota:
      'Could not save export settings (storage full or blocked). Download was not started — try freeing browser storage or closing other tabs.',
    prefsSaveUnknown:
      'Could not save export settings. Download was not started — try again or check browser privacy settings.',
  };
}

export default function ExportButton({
  data,
  fullSheetExport,
  filename,
  dashboardName,
  dateRange,
  columns,
  label = 'Export CSV',
  settingsStorageKey: settingsStorageKeyProp,
  lang = 'en',
  fullSheetHint,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [columnStates, setColumnStates] = useState<ColumnState[]>([]);
  const [attemptedEmpty, setAttemptedEmpty] = useState(false);
  const [dataSource, setDataSource] = useState<'dashboard' | 'full_sheet'>('dashboard');
  const [timeFormat, setTimeFormat] = useState<TimeFormatId>(DEFAULT_TIME_FORMAT);
  const [prefsNotice, setPrefsNotice] = useState<
    'load_parse' | 'load_version' | 'save_quota' | 'save_unknown' | null
  >(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);

  const hasFullSheet =
    Boolean(fullSheetExport && fullSheetExport.rows.length > 0 && fullSheetExport.columns.length > 0);

  const dashboardSchema = useMemo(() => schemaFromProps(columns, data), [columns, data]);

  const storageKey = useMemo(() => {
    const base = settingsStorageKeyProp ?? dashboardName ?? filename ?? 'export';
    return base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'export';
  }, [settingsStorageKeyProp, dashboardName, filename]);

  const titleId = useId();
  const descriptionId = useId();
  const sourceGroupId = useId();
  const timeGroupId = useId();
  const handleClose = useCallback(() => {
    setPrefsNotice(null);
    setCsvBusy(false);
    setDraggedColumnKey(null);
    setDragOverColumnKey(null);
    setOpen(false);
  }, []);
  const trapRef = useFocusTrap(open, handleClose);
  const t = copyForLang(lang);
  const timeOptions = useMemo(() => timeFormatOptions(lang), [lang]);

  const canOpen = data.length > 0 || hasFullSheet;

  const activeRowsAndTypes = useMemo(() => {
    if (dataSource === 'full_sheet' && hasFullSheet && fullSheetExport) {
      const exportRows = fullSheetExport.filteredRows ?? fullSheetExport.rows;
      return {
        rows: exportRows as Record<string, unknown>[],
        typeMap: columnTypeMapFromFullSheet(fullSheetExport),
      };
    }
    return { rows: data, typeMap: undefined as Map<string, string> | undefined };
  }, [data, dataSource, fullSheetExport, hasFullSheet]);

  const applyDataSource = (
    source: 'dashboard' | 'full_sheet',
    savedColumns: StoredColumnPref[] | null,
  ) => {
    const schema =
      source === 'full_sheet' && hasFullSheet && fullSheetExport
        ? schemaFromFullSheet(fullSheetExport)
        : dashboardSchema;
    const effectiveSaved = shouldUseSavedColumnPrefs(savedColumns, schema) ? savedColumns : null;
    setColumnStates(mergeSchemaWithSaved(schema, effectiveSaved));
    setDataSource(source);
  };

  const handleOpen = () => {
    if (!canOpen) return;
    setAttemptedEmpty(false);
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const prefs = loadCsvExportPrefs(storage, storageKey);
    if (prefs.loadIssue === 'parse_error') setPrefsNotice('load_parse');
    else if (prefs.loadIssue === 'unsupported_version') setPrefsNotice('load_version');
    else setPrefsNotice(null);
    let source: 'dashboard' | 'full_sheet';
    if (!hasFullSheet) {
      source = 'dashboard';
    } else if (data.length === 0) {
      source = 'full_sheet';
    } else {
      source = prefs.dataSource === 'full_sheet' ? 'full_sheet' : 'dashboard';
    }
    applyDataSource(source, prefs.columns);
    setTimeFormat(prefs.timeFormat);
    setOpen(true);
  };

  const handleDataSourceChange = (next: 'dashboard' | 'full_sheet') => {
    if (next === 'full_sheet' && !hasFullSheet) return;
    if (next === 'dashboard' && data.length === 0) return;
    setAttemptedEmpty(false);
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const prefs = loadCsvExportPrefs(storage, storageKey);
    applyDataSource(next, prefs.columns);
  };

  const handleDownload = async () => {
    if (csvBusy) return;
    const active = columnStates.filter((c) => c.enabled);
    if (active.length === 0) {
      setAttemptedEmpty(true);
      return;
    }
    setAttemptedEmpty(false);
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const saveResult = saveCsvExportPrefs(storage, storageKey, {
      timeFormat,
      dataSource,
      columns: columnStates.map((c) => ({ key: c.key, enabled: c.enabled, label: c.label })),
    });
    if (!saveResult.ok) {
      setPrefsNotice(saveResult.reason === 'quota' ? 'save_quota' : 'save_unknown');
      return;
    }
    setPrefsNotice(null);
    const { rows, typeMap } = activeRowsAndTypes;
    setCsvBusy(true);
    try {
      const csv = await buildCsvFromStatesAsync(rows, columnStates, timeFormat, typeMap);
      const base = buildFilename(filename, dashboardName, dateRange);
      const fileBase = dataSource === 'full_sheet' ? `${base}_all-columns` : base;
      downloadCsv(csv, fileBase);
      setOpen(false);
    } finally {
      setCsvBusy(false);
    }
  };

  const setAllEnabled = (enabled: boolean) => {
    setColumnStates((prev) => prev.map((c) => ({ ...c, enabled })));
    setAttemptedEmpty(false);
  };

  const moveColumnBy = (index: number, direction: -1 | 1) => {
    setColumnStates((prev) => moveColumn(prev, index, direction));
  };

  const handleColumnDrop = (targetKey: string) => {
    if (!draggedColumnKey || draggedColumnKey === targetKey) return;
    setColumnStates((prev) => {
      const sourceIndex = prev.findIndex((column) => column.key === draggedColumnKey);
      const targetIndex = prev.findIndex((column) => column.key === targetKey);
      return moveColumnTo(prev, sourceIndex, targetIndex);
    });
    setDraggedColumnKey(null);
    setDragOverColumnKey(null);
  };

  const modal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <button
              type="button"
              aria-hidden="true"
              className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm dark:bg-zinc-950/70"
              onClick={handleClose}
            />
            <div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {t.modalTitle}
                </h2>
                <p id={descriptionId} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t.modalDescription}
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                {prefsNotice ? (
                  <p
                    role="status"
                    className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100"
                  >
                    {prefsNotice === 'load_parse'
                      ? t.prefsLoadParse
                      : prefsNotice === 'load_version'
                        ? t.prefsLoadVersion
                        : prefsNotice === 'save_quota'
                          ? t.prefsSaveQuota
                          : t.prefsSaveUnknown}
                  </p>
                ) : null}
                <fieldset>
                  <legend id={sourceGroupId} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {t.dataSourceLegend}
                  </legend>
                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="radio"
                        name="export-data-source"
                        className="mt-0.5"
                        checked={dataSource === 'dashboard'}
                        disabled={data.length === 0}
                        onChange={() => handleDataSourceChange('dashboard')}
                      />
                      <span>
                        {t.dataSourceDashboard}
                        {data.length === 0 ? (
                          <span className="ml-1 text-zinc-400">({lang === 'th' ? 'ไม่มีข้อมูล' : 'no rows'})</span>
                        ) : null}
                      </span>
                    </label>
                    <label
                      className={`flex items-start gap-2 text-sm ${hasFullSheet ? 'cursor-pointer text-zinc-700 dark:text-zinc-300' : 'cursor-not-allowed text-zinc-400'}`}
                    >
                      <input
                        type="radio"
                        name="export-data-source"
                        className="mt-0.5"
                        checked={dataSource === 'full_sheet'}
                        disabled={!hasFullSheet}
                        onChange={() => handleDataSourceChange('full_sheet')}
                      />
                      <span>
                        {t.dataSourceFullSheet}
                        {!hasFullSheet ? (
                          <span className="ml-1">({lang === 'th' ? 'ไม่พร้อมใช้' : 'unavailable'})</span>
                        ) : null}
                      </span>
                    </label>
                    {hasFullSheet ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {fullSheetHint ?? t.dataSourceFullHint}
                      </p>
                    ) : null}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor={timeGroupId} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {t.timeFormatLegend}
                  </label>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.timeFormatHint}</p>
                  <select
                    id={timeGroupId}
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value as TimeFormatId)}
                    className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {timeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                    onClick={() => setAllEnabled(true)}
                  >
                    {t.selectAll}
                  </button>
                  <button
                    type="button"
                    className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                    onClick={() => setAllEnabled(false)}
                  >
                    {t.deselectAll}
                  </button>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      <th className="w-10 pb-2 pr-2" scope="col">
                        <span className="sr-only">Include</span>
                      </th>
                      <th className="w-20 pb-2 pr-2" scope="col">
                        <span className="sr-only">{t.reorder}</span>
                      </th>
                      <th className="pb-2 pr-2" scope="col">
                        {t.fieldKey}
                      </th>
                      <th className="pb-2" scope="col">
                        {t.headerLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {columnStates.map((col, index) => (
                      <tr
                        key={col.key}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          setDraggedColumnKey(col.key);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          if (draggedColumnKey !== col.key) setDragOverColumnKey(col.key);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleColumnDrop(col.key);
                        }}
                        onDragEnd={() => {
                          setDraggedColumnKey(null);
                          setDragOverColumnKey(null);
                        }}
                        className={dragOverColumnKey === col.key ? 'bg-emerald-50 dark:bg-emerald-950/30' : undefined}
                      >
                        <td className="py-2 pr-2 align-middle">
                          <input
                            type="checkbox"
                            checked={col.enabled}
                            onChange={(e) => {
                              setAttemptedEmpty(false);
                              setColumnStates((prev) =>
                                prev.map((c) => (c.key === col.key ? { ...c, enabled: e.target.checked } : c)),
                              );
                            }}
                            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
                            aria-label={`${t.fieldKey} ${col.key}`}
                          />
                        </td>
                        <td className="py-2 pr-2 align-middle">
                          <div className="flex items-center gap-1" title={t.dragToReorder}>
                            <span
                              className="cursor-grab px-0.5 text-zinc-400 active:cursor-grabbing dark:text-zinc-500"
                              aria-label={`${t.dragToReorder}: ${col.label}`}
                              title={t.dragToReorder}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                              </svg>
                            </span>
                            <button
                              type="button"
                              onClick={() => moveColumnBy(index, -1)}
                              disabled={index === 0}
                              className="rounded border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                              aria-label={`${t.moveUp}: ${col.label}`}
                              title={t.moveUp}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m5 15 7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveColumnBy(index, 1)}
                              disabled={index === columnStates.length - 1}
                              className="rounded border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                              aria-label={`${t.moveDown}: ${col.label}`}
                              title={t.moveDown}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m5 9 7 7 7-7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="max-w-[min(200px,28vw)] truncate py-2 pr-2 align-middle font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {col.key}
                        </td>
                        <td className="py-2 align-middle">
                          <input
                            type="text"
                            value={col.label}
                            disabled={!col.enabled}
                            onChange={(e) => {
                              setColumnStates((prev) =>
                                prev.map((c) => (c.key === col.key ? { ...c, label: e.target.value } : c)),
                              );
                            }}
                            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attemptedEmpty ? (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {t.needOneColumn}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={csvBusy}
                  className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {csvBusy ? t.preparingCsv : t.download}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!canOpen}
        aria-label={label}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700/60 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-zinc-600"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {label}
      </button>
      {modal}
    </>
  );
}
