import { describe, it, expect } from 'vitest';
import {
  formatExportCellValue,
  googleValueToDate,
  isSheetTemporalType,
  calendarDateToIsoLocal,
} from './exportCsvFormat';

describe('isSheetTemporalType', () => {
  it('recognizes sheet temporal types', () => {
    expect(isSheetTemporalType('date')).toBe(true);
    expect(isSheetTemporalType('datetime')).toBe(true);
    expect(isSheetTemporalType('timeofday')).toBe(true);
    expect(isSheetTemporalType('string')).toBe(false);
  });
});

describe('googleValueToDate', () => {
  it('maps Google date serial numbers when column type is date', () => {
    const d = googleValueToDate(44927, 'date');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBeGreaterThan(1900);
  });

  it('still treats large numbers as epoch milliseconds', () => {
    const ms = Date.UTC(2024, 0, 15, 12, 0, 0);
    const d = googleValueToDate(ms, undefined);
    expect(d?.getTime()).toBe(ms);
  });

  it('parses en-GB style date with comma before time (dashboard display strings)', () => {
    const d = googleValueToDate('04/03/2024, 12:00:00', undefined);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(4);
    expect(d!.getHours()).toBe(12);
  });

  it('does not use loose Date parsing for ambiguous strings', () => {
    expect(googleValueToDate('totally not a date', undefined)).toBeNull();
  });
});

describe('formatExportCellValue', () => {
  it('does not treat Holiday as temporal via stray "day" substring', () => {
    expect(formatExportCellValue('vacation', 'iso_date', { fieldKey: 'Holiday' })).toBe('vacation');
  });

  it('still treats a whole-word day field as temporal', () => {
    const d = new Date(2024, 5, 1, 0, 0, 0);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(formatExportCellValue(d, 'iso_date', { fieldKey: 'Trips per day' })).toBe(iso);
  });

  it('formats sheet date serial as ISO date when column type is date', () => {
    const out = formatExportCellValue(44927, 'iso_date', { columnType: 'date' });
    expect(out).not.toBe('44927');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reformats en-GB time column strings consistently for iso_datetime', () => {
    const out = formatExportCellValue('04/03/2024, 12:00:00', 'iso_datetime', { fieldKey: 'time' });
    expect(out).toMatch(/^2024-03-04T12:00:00$/);
  });
});

describe('calendarDateToIsoLocal', () => {
  it('uses local calendar components, not UTC', () => {
    const d = new Date(2024, 5, 15);
    expect(calendarDateToIsoLocal(d)).toBe('2024-06-15');
  });
});
