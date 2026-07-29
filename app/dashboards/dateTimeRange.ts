export type DateTimeRange = {
  /** Bangkok wall-clock digits in `YYYY-MM-DDTHH:mm` form. */
  start: string;
  /** Bangkok wall-clock digits in `YYYY-MM-DDTHH:mm` form. */
  end: string;
};

export const EMPTY_DATE_TIME_RANGE: DateTimeRange = { start: '', end: '' };

const DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Dashboard sheet dates are normalized as Bangkok wall-clock digits stored in
 * UTC fields. Parse picker values the same way so filtering never depends on
 * the viewer's local timezone.
 */
export function dateTimeInputToUtcMs(value: string, endOfDay = false): number | null {
  const match = DATE_TIME_RE.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText == null ? (endOfDay ? 23 : 0) : Number(hourText);
  const minute = minuteText == null ? (endOfDay ? 59 : 0) : Number(minuteText);
  const second = secondText == null ? (endOfDay ? 59 : 0) : Number(secondText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

export function isDateInDateTimeRange(date: Date | null, range: DateTimeRange): boolean {
  if (!date) return false;
  const start = range.start ? dateTimeInputToUtcMs(range.start) : null;
  const end = range.end ? dateTimeInputToUtcMs(range.end, true) : null;
  const value = date.getTime();
  if (start != null && value < start) return false;
  if (end != null && value > end) return false;
  return true;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function monthKeyToDateTimeRange(monthKey: string): DateTimeRange {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return EMPTY_DATE_TIME_RANGE;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return EMPTY_DATE_TIME_RANGE;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${pad(month)}-01T00:00`,
    end: `${year}-${pad(month)}-${pad(lastDay)}T23:59`,
  };
}

/** Convert a contiguous picker range to the month chunks needed by GViz. */
export function dateTimeRangeToMonthKeys(range: DateTimeRange): string[] {
  const startMs = dateTimeInputToUtcMs(range.start);
  const endMs = dateTimeInputToUtcMs(range.end, true);
  if (startMs == null || endMs == null || endMs < startMs) return [];

  const start = new Date(startMs);
  const end = new Date(endMs);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  const keys: string[] = [];

  // A guard keeps corrupt persisted state from triggering an unbounded fetch.
  while (cursor.getTime() <= endMonth && keys.length < 120) {
    keys.push(`${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/**
 * Upgrade the former month/day picker state to one contiguous range.
 * Non-contiguous legacy day selections become their inclusive min/max span.
 */
export function legacyDateFiltersToRange(
  monthKeys: string[],
  dayKeys: string[] = [],
): DateTimeRange {
  const validDays = dayKeys.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  if (validDays.length > 0) {
    return {
      start: `${validDays[0]}T00:00`,
      end: `${validDays[validDays.length - 1]}T23:59`,
    };
  }

  const validMonths = monthKeys.filter((value) => /^\d{4}-\d{2}$/.test(value)).sort();
  if (validMonths.length === 0) return EMPTY_DATE_TIME_RANGE;
  const start = monthKeyToDateTimeRange(validMonths[0]!);
  const end = monthKeyToDateTimeRange(validMonths[validMonths.length - 1]!);
  return { start: start.start, end: end.end };
}

export function isCompleteDateTimeRange(
  range: DateTimeRange | null | undefined,
): boolean {
  if (!range) return false;
  const start = dateTimeInputToUtcMs(range.start);
  const end = dateTimeInputToUtcMs(range.end, true);
  return start != null && end != null && start <= end;
}
