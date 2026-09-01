import type { MultiTrendDatum, TrendDatum } from 'app/ui/TrendChart';
import {
  dateTimeInputToUtcMs,
  isCompleteDateTimeRange,
  type DateTimeRange,
} from './dateTimeRange';
import { normalizeLabel, remarkMatchesAllowedTarget } from './dashboardDataUtils';

export type TrendBreakdownMode = 'timeline' | 'month';

export type TrendMonthOption = {
  key: string;
  label: string;
  color: string;
};

type ParsedMonthKey = {
  year: number;
  monthIndex: number;
};

const MONTH_LABELS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
} as const;

/**
 * A fixed 24-slot palette lets a month keep its color across renders while
 * guaranteeing that any rolling 24-month dashboard window has no duplicates.
 */
const TREND_MONTH_COLORS = [
  '#E63946',
  '#457B9D',
  '#2A9D8F',
  '#F4A261',
  '#8B5CF6',
  '#E76F51',
  '#06B6D4',
  '#84CC16',
  '#EC4899',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
  '#EF4444',
  '#3B82F6',
  '#10B981',
  '#D946EF',
  '#F97316',
  '#0EA5E9',
  '#A3E635',
  '#F43F5E',
  '#7C3AED',
  '#22C55E',
  '#EAB308',
  '#64748B',
] as const;

const parseMonthKey = (key: string): ParsedMonthKey | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
};

const monthColor = ({ year, monthIndex }: ParsedMonthKey): string => {
  const serialMonth = year * 12 + monthIndex;
  const colorIndex = ((serialMonth % TREND_MONTH_COLORS.length) + TREND_MONTH_COLORS.length)
    % TREND_MONTH_COLORS.length;
  return TREND_MONTH_COLORS[colorIndex];
};

const monthLabel = (
  { year, monthIndex }: ParsedMonthKey,
  lang: 'en' | 'th',
): string => `${MONTH_LABELS[lang][monthIndex]} ${year}`;

const isValidDate = (date: Date | null): date is Date =>
  date !== null && Number.isFinite(date.getTime());

const formatDailyLabel = (date: Date): string =>
  `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;

export function filterTrendAlerts<
  T extends { parsedDate: Date | null; monthKey: string | null; remarks: string },
>(alerts: readonly T[], remarkFilter: string): T[] {
  if (remarkFilter === 'all') return [...alerts];
  const normalizedFilter = normalizeLabel(remarkFilter);
  return alerts.filter((alert) =>
    remarkMatchesAllowedTarget(normalizeLabel(alert.remarks), normalizedFilter),
  );
}

/** Preserve the detail dashboard's existing DD/MM/YYYY labels and sparse days. */
export function buildDailyTrendData(
  alerts: readonly { parsedDate: Date | null }[],
): TrendDatum[] {
  const counts = new Map<number, number>();

  alerts.forEach(({ parsedDate }) => {
    if (!isValidDate(parsedDate)) return;
    const dayTimestamp = Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate(),
    );
    counts.set(dayTimestamp, (counts.get(dayTimestamp) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort(([left], [right]) => left - right)
    .map(([timestamp, value]) => ({
      label: formatDailyLabel(new Date(timestamp)),
      value,
    }));
}

export function getTrendMonthOptions(
  alerts: readonly { monthKey: string | null }[],
  lang: 'en' | 'th',
): TrendMonthOption[] {
  const keys = new Set<string>();
  alerts.forEach(({ monthKey: key }) => {
    if (key && parseMonthKey(key)) keys.add(key);
  });

  return Array.from(keys)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => {
      const parsed = parseMonthKey(key)!;
      return {
        key,
        label: monthLabel(parsed, lang),
        color: monthColor(parsed),
      };
    });
}

/** Empty or fully stale persisted state means "all available months". */
export function resolveSelectedTrendMonths(
  options: readonly TrendMonthOption[],
  selectedKeys: readonly string[],
): TrendMonthOption[] {
  const selected = new Set(selectedKeys);
  const resolved = options.filter((option) => selected.has(option.key));
  return resolved.length > 0 ? resolved : [...options];
}

/**
 * Toggle against the resolved selection. An empty array is the canonical
 * representation of "all", including when the last explicit month is removed.
 */
export function toggleTrendMonthFilter(
  availableKeys: readonly string[],
  selectedKeys: readonly string[],
  toggledKey: string,
): string[] {
  const available = Array.from(new Set(availableKeys));
  const availableSet = new Set(available);
  const explicitSelection = selectedKeys.filter((key) => availableSet.has(key));
  const selected = new Set(explicitSelection.length > 0 ? explicitSelection : available);

  if (!availableSet.has(toggledKey)) {
    if (selected.size === available.length) return [];
    return available.filter((key) => selected.has(key));
  }

  if (selected.has(toggledKey)) selected.delete(toggledKey);
  else selected.add(toggledKey);

  if (selected.size === 0 || selected.size === available.length) return [];
  return available.filter((key) => selected.has(key));
}

type CompleteRange = {
  startMs: number;
  endMs: number;
};

const parseCompleteRange = (range?: DateTimeRange): CompleteRange | null => {
  if (!isCompleteDateTimeRange(range)) return null;
  const startMs = dateTimeInputToUtcMs(range!.start);
  const endMs = dateTimeInputToUtcMs(range!.end, true);
  if (startMs === null || endMs === null) return null;
  return { startMs, endMs };
};

const dayIntersectsRange = (
  month: ParsedMonthKey,
  day: number,
  range: CompleteRange,
): boolean => {
  const dayStart = Date.UTC(month.year, month.monthIndex, day);
  const normalized = new Date(dayStart);
  if (
    normalized.getUTCFullYear() !== month.year ||
    normalized.getUTCMonth() !== month.monthIndex ||
    normalized.getUTCDate() !== day
  ) {
    return false;
  }
  const dayEnd = dayStart + 86_400_000 - 1;
  return dayStart <= range.endMs && dayEnd >= range.startMs;
};

export function buildMonthlyTrendData(
  alerts: readonly { parsedDate: Date | null; monthKey: string | null }[],
  months: readonly TrendMonthOption[],
  range?: DateTimeRange,
): MultiTrendDatum[] {
  if (months.length === 0) return [];

  const completeRange = parseCompleteRange(range);
  const selectedKeys = new Set(months.map((month) => month.key));
  const counts = new Map<string, Map<number, number>>();
  const observedDays = new Set<number>();

  alerts.forEach(({ parsedDate, monthKey: key }) => {
    if (!key || !selectedKeys.has(key) || !isValidDate(parsedDate)) return;
    const timestamp = parsedDate.getTime();
    if (
      completeRange &&
      (timestamp < completeRange.startMs || timestamp > completeRange.endMs)
    ) {
      return;
    }

    const day = parsedDate.getUTCDate();
    observedDays.add(day);
    const monthCounts = counts.get(key) ?? new Map<number, number>();
    monthCounts.set(day, (monthCounts.get(day) ?? 0) + 1);
    counts.set(key, monthCounts);
  });

  const candidateDays = completeRange
    ? Array.from({ length: 31 }, (_, index) => index + 1)
    : Array.from(observedDays).sort((left, right) => left - right);

  return candidateDays.flatMap((day) => {
    const values: Record<string, number> = {};
    let hasEligibleSeries = false;

    months.forEach((month) => {
      const parsedMonth = parseMonthKey(month.key);
      const eligible = Boolean(
        completeRange &&
        parsedMonth &&
        dayIntersectsRange(parsedMonth, day, completeRange),
      );

      if (completeRange && !eligible) {
        values[month.label] = Number.NaN;
        return;
      }

      hasEligibleSeries = true;
      values[month.label] = counts.get(month.key)?.get(day) ?? 0;
    });

    if (completeRange && !hasEligibleSeries) return [];
    return [{ label: String(day).padStart(2, '0'), values }];
  });
}
