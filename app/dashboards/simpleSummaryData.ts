import type { GoogleSheetColumn, GoogleSheetRow } from './googleSheetParse';

export type SimpleSummaryRecord = {
  month: string;
  alertType: string;
  count: number;
};

export type SimpleSummaryData = {
  records: SimpleSummaryRecord[];
  months: string[];
  alertTypes: string[];
  error: string | null;
};

export type SimpleSummaryComparison = {
  months: string[];
  alertTypes: string[];
  rows: { month: string; counts: Record<string, number>; total: number }[];
  total: number;
  typeTotals: Record<string, number>;
};

const headerAliases = {
  month: ['เดือน (yyyy-mm)', 'เดือน', 'month', 'month (yyyy-mm)'],
  alertType: ['ประเภท (คอลัมน์ h)', 'ประเภท', 'alert type', 'type'],
  count: ['จำนวนสรุป', 'count', 'total', 'summary count'],
};

// Raw sheets may have Month/Count helper columns. These event fields keep them
// on the existing raw dashboard, including all current ALERT_TIME_ALIASES.
const rawEventHeaders = new Set([
  'alert date time', 'track time', 'date', 'timestamp',
  'vehicle no', 'vehicle no th', 'driver name', 'remarks', 'remark',
  'fleet', 'speed', 'max speed',
]);

const normalizeHeader = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const isBlank = (value: unknown) => value == null || (typeof value === 'string' && value.trim() === '');
const failedSummary = (error: string): SimpleSummaryData => ({
  records: [], months: [], alertTypes: [], error,
});

function parseCount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value.trim())) {
    return null;
  }
  const count = typeof value === 'number' ? value : Number(value.trim().replace(/,/g, ''));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function readCell(row: GoogleSheetRow, column: GoogleSheetColumn) {
  return Object.prototype.hasOwnProperty.call(row, column.fieldKey) ? row[column.fieldKey] : undefined;
}

/** Detect the complete summarized schema without reading or validating data rows. */
export function isSimpleSummarySheet(columns: GoogleSheetColumn[]): boolean {
  const labels = columns.map((column) => normalizeHeader(column.label));
  if (labels.some((label) => rawEventHeaders.has(label))) return false;
  return Object.values(headerAliases).every((aliases) => (
    labels.filter((label) => aliases.includes(label)).length === 1
  ));
}

/** Read already summarized counts; no raw-event or alert-category inference is applied. */
export function parseSimpleSummary(
  columns: GoogleSheetColumn[],
  rows: GoogleSheetRow[],
): SimpleSummaryData {
  const fields = {} as Record<keyof typeof headerAliases, GoogleSheetColumn>;
  for (const field of Object.keys(headerAliases) as (keyof typeof headerAliases)[]) {
    const matches = columns.filter((column) => headerAliases[field].includes(normalizeHeader(column.label)));
    if (matches.length !== 1) {
      return failedSummary(matches.length === 0
        ? 'The summary sheet must include Month, Alert Type, and Count columns (เดือน (YYYY-MM), ประเภท (คอลัมน์ H), จำนวนสรุป).'
        : `The summary sheet has more than one ${field === 'alertType' ? 'alert type' : field} column. Use one column for each summary field.`);
    }
    fields[field] = matches[0]!;
  }

  const countsByMonth = new Map<string, Map<string, number>>();
  const types = new Set<string>();
  let total = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (Object.values(row).every(isBlank)) continue;

    const rawMonth = readCell(row, fields.month);
    const month = typeof rawMonth === 'string' ? rawMonth.trim() : '';
    if (!/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) {
      return failedSummary(`Row ${index + 2}: Month must use YYYY-MM with a valid month, for example 2026-07.`);
    }

    const rawType = readCell(row, fields.alertType);
    const alertType = typeof rawType === 'string' ? rawType.trim() : '';
    if (!alertType) {
      return failedSummary(`Row ${index + 2}: Alert Type must contain a name.`);
    }

    const count = parseCount(readCell(row, fields.count));
    if (count === null) {
      return failedSummary(`Row ${index + 2}: Count must be a non-negative whole number, for example 0 or 1,584.`);
    }
    total += count;
    if (!Number.isSafeInteger(total)) {
      return failedSummary(`Row ${index + 2}: The summary total exceeds the supported whole-number range.`);
    }

    const monthCounts = countsByMonth.get(month) ?? new Map<string, number>();
    monthCounts.set(alertType, (monthCounts.get(alertType) ?? 0) + count);
    countsByMonth.set(month, monthCounts);
    types.add(alertType);
  }

  const months = Array.from(countsByMonth.keys()).sort();
  const alertTypes = Array.from(types).sort((a, b) => a.localeCompare(b));
  const records = months.flatMap((month) => alertTypes.flatMap((alertType) => {
    const count = countsByMonth.get(month)!.get(alertType);
    return count === undefined ? [] : [{ month, alertType, count }];
  }));
  return { records, months, alertTypes, error: null };
}

/** Empty selections mean all; type filtering retains the original month domain. */
export function buildSimpleSummaryComparison(
  records: SimpleSummaryRecord[],
  selectedMonths?: string[],
  selectedTypes?: string[],
): SimpleSummaryComparison {
  const monthSelection = selectedMonths?.length ? new Set(selectedMonths) : null;
  const typeSelection = selectedTypes?.length ? new Set(selectedTypes) : null;
  const months = Array.from(new Set(records.map((record) => record.month)))
    .filter((month) => !monthSelection || monthSelection.has(month)).sort();
  const alertTypes = Array.from(new Set(records.map((record) => record.alertType)))
    .filter((alertType) => !typeSelection || typeSelection.has(alertType))
    .sort((a, b) => a.localeCompare(b));

  const countsByMonth = new Map(months.map((month) => [
    month, new Map(alertTypes.map((alertType) => [alertType, 0])),
  ]));
  const typeTotals = new Map(alertTypes.map((alertType) => [alertType, 0]));
  for (const { month, alertType, count } of records) {
    const monthCounts = countsByMonth.get(month);
    if (!monthCounts?.has(alertType)) continue;
    monthCounts.set(alertType, monthCounts.get(alertType)! + count);
    typeTotals.set(alertType, typeTotals.get(alertType)! + count);
  }

  const comparisonRows = months.map((month) => {
    const counts = countsByMonth.get(month)!;
    return {
      month,
      counts: Object.fromEntries(counts),
      total: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
    };
  });
  return {
    months,
    alertTypes,
    rows: comparisonRows,
    total: comparisonRows.reduce((sum, row) => sum + row.total, 0),
    typeTotals: Object.fromEntries(typeTotals),
  };
}
