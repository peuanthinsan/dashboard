import { formatDateTimeGB } from 'app/dashboards/dateFormat';

export type TimeFormatId =
  | 'as_is'
  | 'iso_date'
  | 'iso_datetime'
  | 'en_gb_datetime'
  | 'en_us_datetime'
  | 'locale_datetime';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Avoid matching "Holiday", "Sunday", etc. — only whole-word "day". */
export function fieldKeyLooksTemporal(fieldKey: string): boolean {
  if (/date|time|month|timestamp|วัน|เวลา|เดือน/i.test(fieldKey)) return true;
  return /\bday\b/i.test(fieldKey);
}

/** Local calendar YYYY-MM-DD (for exports; not UTC midnight). */
export function calendarDateToIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Google Sheets / Excel serial: whole days since 1899-12-30 (UTC). */
function sheetsSerialToDate(serial: number): Date {
  const wholeDays = Math.floor(serial);
  const fraction = serial - wholeDays;
  const MS_PER_DAY = 86400000;
  const epochUtc = Date.UTC(1899, 11, 30);
  return new Date(epochUtc + wholeDays * MS_PER_DAY + fraction * MS_PER_DAY);
}

function parseExportDateString(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ddmmyyyy = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/,
  );
  if (ddmmyyyy) {
    const dd = parseInt(ddmmyyyy[1]!, 10);
    const mm = parseInt(ddmmyyyy[2]!, 10) - 1;
    const yyyy = parseInt(ddmmyyyy[3]!, 10);
    const hour = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
    const min = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
    const sec = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
    const d = new Date(yyyy, mm, dd, hour, min, sec);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const ddmmyyyyComma = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
  );
  if (ddmmyyyyComma) {
    const dd = parseInt(ddmmyyyyComma[1]!, 10);
    const mm = parseInt(ddmmyyyyComma[2]!, 10) - 1;
    const yyyy = parseInt(ddmmyyyyComma[3]!, 10);
    const hour = parseInt(ddmmyyyyComma[4]!, 10);
    const min = parseInt(ddmmyyyyComma[5]!, 10);
    const sec = parseInt(ddmmyyyyComma[6]!, 10);
    const d = new Date(yyyy, mm, dd, hour, min, sec);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const y = parseInt(isoDateOnly[1]!, 10);
    const m = parseInt(isoDateOnly[2]!, 10) - 1;
    const day = parseInt(isoDateOnly[3]!, 10);
    const d = new Date(y, m, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function isSheetTemporalType(type: string | undefined): boolean {
  if (!type) return false;
  const u = type.toLowerCase();
  return u === 'date' || u === 'datetime' || u === 'timeofday';
}

function toLocalIsoDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function toLocalIsoDate(d: Date): string {
  return calendarDateToIsoLocal(d);
}

/** Best-effort parse for Google Visualization cell values and plain strings. */
export function googleValueToDate(value: unknown, colType: string | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e11) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (isSheetTemporalType(colType) && value >= 1 && value < 1e6) {
      const d = sheetsSerialToDate(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof value === 'string') {
    return parseExportDateString(value);
  }
  if (Array.isArray(value) && colType === 'timeofday') {
    const h = Number(value[0] ?? 0);
    const m = Number(value[1] ?? 0);
    const s = Number(value[2] ?? 0);
    const ms = Number(value[3] ?? 0);
    const d = new Date(1970, 0, 1, h, m, s, ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatBoolean(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

export function formatExportCellValue(
  value: unknown,
  timeFormat: TimeFormatId,
  opts?: { columnType?: string; fieldKey?: string },
): string {
  if (value == null || value === '') return '';

  if (timeFormat === 'as_is') {
    if (typeof value === 'boolean') return formatBoolean(value);
    return String(value);
  }

  const shouldTryTemporal =
    isSheetTemporalType(opts?.columnType) ||
    Boolean(opts?.fieldKey && fieldKeyLooksTemporal(opts.fieldKey));

  if (!shouldTryTemporal) {
    if (typeof value === 'boolean') return formatBoolean(value);
    return String(value);
  }

  const d = googleValueToDate(value, opts?.columnType);
  if (!d) {
    if (typeof value === 'boolean') return formatBoolean(value);
    return String(value);
  }

  switch (timeFormat) {
    case 'iso_date':
      return toLocalIsoDate(d);
    case 'iso_datetime':
      return toLocalIsoDateTime(d);
    case 'en_gb_datetime':
      return formatDateTimeGB(d);
    case 'en_us_datetime':
      return d.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    case 'locale_datetime':
      return d.toLocaleString();
    default:
      return String(value);
  }
}

export function timeFormatOptions(lang: 'en' | 'th'): { id: TimeFormatId; label: string }[] {
  if (lang === 'th') {
    return [
      { id: 'as_is', label: 'ตามค่าในชีต (ไม่แปลง)' },
      { id: 'iso_date', label: 'วันที่ ISO (YYYY-MM-DD)' },
      { id: 'iso_datetime', label: 'วันเวลา ISO แบบท้องถิ่น' },
      { id: 'en_gb_datetime', label: 'อังกฤษ DD/MM/YYYY ชม.:นาที:วินาที' },
      { id: 'en_us_datetime', label: 'อเมริกัน MM/DD/YYYY' },
      { id: 'locale_datetime', label: 'ตามภาษาของเบราว์เซอร์' },
    ];
  }
  return [
    { id: 'as_is', label: 'As in sheet (no conversion)' },
    { id: 'iso_date', label: 'ISO date (YYYY-MM-DD)' },
    { id: 'iso_datetime', label: 'ISO-like local date & time' },
    { id: 'en_gb_datetime', label: 'British DD/MM/YYYY HH:mm:ss' },
    { id: 'en_us_datetime', label: 'US MM/DD/YYYY h:mm:ss AM/PM' },
    { id: 'locale_datetime', label: 'Browser locale' },
  ];
}
