import type { TrendDatum } from 'app/ui/TrendChart';
import { normalizeLabel, remarkMatchesAllowedTarget } from './dashboardDataUtils';
import { dateTimeRangeToMonthKeys, type DateTimeRange } from './dateTimeRange';

export type TrendMonthOption = {
  key: string;
  label: string;
};

type ParsedMonthKey = {
  year: number;
  monthIndex: number;
};

const MONTH_LABELS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
} as const;

const parseMonthKey = (key: string): ParsedMonthKey | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
};

const monthLabel = (
  { year, monthIndex }: ParsedMonthKey,
  lang: 'en' | 'th',
): string => `${MONTH_LABELS[lang][monthIndex]} ${year}`;

export function filterTrendAlerts<
  T extends { parsedDate: Date | null; monthKey: string | null; remarks: string },
>(alerts: readonly T[], remarkFilter: string): T[] {
  if (remarkFilter === 'all') return [...alerts];
  const normalizedFilter = normalizeLabel(remarkFilter);
  return alerts.filter((alert) =>
    remarkMatchesAllowedTarget(normalizeLabel(alert.remarks), normalizedFilter),
  );
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
      };
    });
}

/** Build the complete chronological month domain touched by the active date range. */
export function getTrendMonthOptionsForRange(
  range: DateTimeRange,
  lang: 'en' | 'th',
): TrendMonthOption[] {
  return dateTimeRangeToMonthKeys(range).map((key) => {
    const parsed = parseMonthKey(key)!;
    return {
      key,
      label: monthLabel(parsed, lang),
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

/** Build one chronological total for every selected month, including zeroes. */
export function buildMonthlyTrendTotals(
  alerts: readonly { monthKey: string | null }[],
  months: readonly TrendMonthOption[],
): TrendDatum[] {
  const orderedMonths = [...months].sort((left, right) => left.key.localeCompare(right.key));
  const counts = new Map(orderedMonths.map((month) => [month.key, 0]));

  alerts.forEach(({ monthKey }) => {
    if (!monthKey || !counts.has(monthKey)) return;
    counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
  });

  return orderedMonths.map((month) => ({
    label: month.label,
    value: counts.get(month.key) ?? 0,
  }));
}
