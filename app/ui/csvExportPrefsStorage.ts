import type { TimeFormatId } from './exportCsvFormat';

export const CSV_EXPORT_STORAGE_PREFIX = 'songdee:csv-export:';

export type StoredColumnPref = { key: string; enabled: boolean; label: string };

export type CsvExportPrefsLoad = {
  columns: StoredColumnPref[] | null;
  timeFormat: TimeFormatId;
  dataSource: 'dashboard' | 'full_sheet';
  loadIssue: 'parse_error' | 'unsupported_version' | null;
};

export type CsvExportSavePayload = {
  timeFormat: TimeFormatId;
  dataSource: 'dashboard' | 'full_sheet';
  columns: StoredColumnPref[];
};

const DEFAULT_TIME_FORMAT: TimeFormatId = 'as_is';

function isTimeFormatId(v: unknown): v is TimeFormatId {
  return (
    v === 'as_is' ||
    v === 'iso_date' ||
    v === 'iso_datetime' ||
    v === 'en_gb_datetime' ||
    v === 'en_us_datetime' ||
    v === 'locale_datetime'
  );
}

export function loadCsvExportPrefs(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  storageKey: string,
): CsvExportPrefsLoad {
  const defaults = (): CsvExportPrefsLoad => ({
    columns: null,
    timeFormat: DEFAULT_TIME_FORMAT,
    dataSource: 'dashboard',
    loadIssue: null,
  });

  if (!storage) {
    return defaults();
  }

  try {
    const raw = storage.getItem(CSV_EXPORT_STORAGE_PREFIX + storageKey);
    if (!raw) {
      return defaults();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...defaults(), loadIssue: 'parse_error' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { ...defaults(), loadIssue: 'unsupported_version' };
    }

    const o = parsed as Record<string, unknown>;

    if (o.version === 2 && Array.isArray(o.columns)) {
      return {
        columns: o.columns as StoredColumnPref[],
        timeFormat: isTimeFormatId(o.timeFormat) ? o.timeFormat : DEFAULT_TIME_FORMAT,
        dataSource: o.dataSource === 'full_sheet' ? 'full_sheet' : 'dashboard',
        loadIssue: null,
      };
    }

    if (o.version === 1 && Array.isArray(o.columns)) {
      return {
        columns: o.columns as StoredColumnPref[],
        timeFormat: DEFAULT_TIME_FORMAT,
        dataSource: 'dashboard',
        loadIssue: null,
      };
    }

    return { ...defaults(), loadIssue: 'unsupported_version' };
  } catch {
    return { ...defaults(), loadIssue: 'parse_error' };
  }
}

export function saveCsvExportPrefs(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  storageKey: string,
  payload: CsvExportSavePayload,
): { ok: true } | { ok: false; reason: 'quota' | 'unknown' } {
  if (!storage) {
    return { ok: false, reason: 'unknown' };
  }
  try {
    const body = {
      version: 2 as const,
      timeFormat: payload.timeFormat,
      dataSource: payload.dataSource,
      columns: payload.columns,
    };
    storage.setItem(CSV_EXPORT_STORAGE_PREFIX + storageKey, JSON.stringify(body));
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      return { ok: false, reason: 'quota' };
    }
    return { ok: false, reason: 'unknown' };
  }
}
