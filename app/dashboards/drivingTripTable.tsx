import type { GoogleSheetColumn } from './googleSheetParse';
import type { Column } from 'app/ui/DataTable';
import { normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';
import { formatDurationDisplay, isDurationColumnLabel } from './drivingDurationFormat';
import { parseDurationHours } from './drivingSheetRows';

export type SheetTripRow = Record<string, unknown> & { _id: number };

export function tripTableSortFieldKey(fieldKey: string): string {
  return `_sort_${fieldKey}`;
}

export function isLocationColumnLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  return normalized.includes('location') || normalized.includes('address') || normalized.includes('landmark');
}

function renderLocationCell(value: unknown) {
  const text = toDisplayString(value).trim();
  if (!text || text === '—') {
    return <span className="text-zinc-300">—</span>;
  }
  return (
    <span
      className="line-clamp-3 break-words text-xs leading-snug text-zinc-700 dark:text-zinc-300"
      title={text}
    >
      {text}
    </span>
  );
}

export function tripRowSortValue(label: string, value: unknown): string | number {
  if (value == null || value === '') return '';
  if (isDurationColumnLabel(label)) {
    return parseDurationHours(value);
  }
  const date = parseDate(value);
  if (date) return date.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  const numeric = Number(raw.replace(/,/g, ''));
  if (raw !== '' && Number.isFinite(numeric)) return numeric;
  return normalizeLabel(raw);
}

export function buildTripTableColumns(columns: GoogleSheetColumn[]): Column<SheetTripRow>[] {
  return columns.map((col, index) => ({
    key: col.fieldKey,
    sortKey: tripTableSortFieldKey(col.fieldKey),
    label: col.label,
    sortable: true,
    stickyLeft: index === 0,
    wrap: isLocationColumnLabel(col.label),
    render: (value) => {
      if (value == null || value === '') {
        return <span className="text-zinc-300">—</span>;
      }
      if (isDurationColumnLabel(col.label)) {
        return <span className="tabular-nums">{formatDurationDisplay(value)}</span>;
      }
      if (isLocationColumnLabel(col.label)) {
        return renderLocationCell(value);
      }
      return <span>{toDisplayString(value)}</span>;
    },
  }));
}

export function buildTripTableRows(
  sourceRows: Record<string, unknown>[],
  columns: GoogleSheetColumn[],
): SheetTripRow[] {
  return sourceRows.map((row, index) => {
    const sortFields: Record<string, string | number> = {};
    for (const col of columns) {
      sortFields[tripTableSortFieldKey(col.fieldKey)] = tripRowSortValue(col.label, row[col.fieldKey]);
    }
    return { _id: index, ...row, ...sortFields };
  });
}

export function filterTripSourceRows(
  rows: Record<string, unknown>[],
  search: string,
  columns: GoogleSheetColumn[],
): Record<string, unknown>[] {
  const term = normalizeLabel(search.trim());
  if (!term) return rows;
  return rows.filter((row) => {
    const haystack = columns
      .map((col) => {
        const value = row[col.fieldKey];
        if (value == null || value === '') return '';
        if (isDurationColumnLabel(col.label)) {
          return formatDurationDisplay(value);
        }
        return toDisplayString(value);
      })
      .join(' ');
    return normalizeLabel(haystack).includes(term);
  });
}

export function buildTripExportRows(
  sourceRows: Record<string, unknown>[],
  columns: GoogleSheetColumn[],
): Record<string, string>[] {
  return sourceRows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col.fieldKey];
      if (value == null || value === '') {
        out[col.label] = '';
      } else if (isDurationColumnLabel(col.label)) {
        out[col.label] = formatDurationDisplay(value);
      } else {
        out[col.label] = String(value);
      }
    }
    return out;
  });
}
