import { describe, it, expect, beforeEach } from 'vitest';
import {
  CSV_EXPORT_STORAGE_PREFIX,
  loadCsvExportPrefs,
  saveCsvExportPrefs,
} from './csvExportPrefsStorage';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  } as Storage;
}

describe('loadCsvExportPrefs', () => {
  it('returns defaults when storage is null', () => {
    const r = loadCsvExportPrefs(null, 'dash');
    expect(r.columns).toBeNull();
    expect(r.timeFormat).toBe('as_is');
    expect(r.dataSource).toBe('dashboard');
    expect(r.loadIssue).toBeNull();
  });

  it('returns parse_error when JSON is invalid', () => {
    const s = memoryStorage();
    s.setItem(`${CSV_EXPORT_STORAGE_PREFIX}x`, '{not json');
    const r = loadCsvExportPrefs(s, 'x');
    expect(r.loadIssue).toBe('parse_error');
    expect(r.columns).toBeNull();
  });

  it('loads v2 prefs', () => {
    const s = memoryStorage();
    s.setItem(
      `${CSV_EXPORT_STORAGE_PREFIX}d`,
      JSON.stringify({
        version: 2,
        timeFormat: 'iso_date',
        dataSource: 'full_sheet',
        columns: [{ key: 'a', enabled: true, label: 'A' }],
      }),
    );
    const r = loadCsvExportPrefs(s, 'd');
    expect(r.loadIssue).toBeNull();
    expect(r.timeFormat).toBe('iso_date');
    expect(r.dataSource).toBe('full_sheet');
    expect(r.columns).toEqual([{ key: 'a', enabled: true, label: 'A' }]);
  });

  it('returns unsupported_version when shape is not v1 or v2', () => {
    const s = memoryStorage();
    s.setItem(`${CSV_EXPORT_STORAGE_PREFIX}bad`, JSON.stringify({ version: 99, columns: [] }));
    const r = loadCsvExportPrefs(s, 'bad');
    expect(r.loadIssue).toBe('unsupported_version');
  });
});

describe('saveCsvExportPrefs', () => {
  let s: Storage;

  beforeEach(() => {
    s = memoryStorage();
  });

  it('returns ok false when storage is null', () => {
    const r = saveCsvExportPrefs(null, 'k', {
      timeFormat: 'as_is',
      dataSource: 'dashboard',
      columns: [],
    });
    expect(r).toEqual({ ok: false, reason: 'unknown' });
  });

  it('persists v2 payload', () => {
    const r = saveCsvExportPrefs(s, 'k', {
      timeFormat: 'iso_datetime',
      dataSource: 'dashboard',
      columns: [{ key: 'x', enabled: false, label: 'X' }],
    });
    expect(r).toEqual({ ok: true });
    const raw = s.getItem(`${CSV_EXPORT_STORAGE_PREFIX}k`);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(2);
    expect(parsed.columns).toHaveLength(1);
  });

  it('returns quota when setItem throws QuotaExceededError', () => {
    const quotaStorage = {
      getItem: () => null,
      setItem: () => {
        const e = new DOMException('quota', 'QuotaExceededError');
        throw e;
      },
      removeItem: () => {},
    } as Storage;
    const r = saveCsvExportPrefs(quotaStorage, 'k', {
      timeFormat: 'as_is',
      dataSource: 'dashboard',
      columns: [],
    });
    expect(r).toEqual({ ok: false, reason: 'quota' });
  });
});
