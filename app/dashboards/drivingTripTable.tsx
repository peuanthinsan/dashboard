import type { GoogleSheetColumn } from './googleSheetParse';
import type { Column } from 'app/ui/DataTable';
import { formatDurationDisplay, isDurationColumnLabel } from './drivingDurationFormat';
import { toDisplayString } from './dashboardDataUtils';

export type SheetTripRow = Record<string, unknown> & { _id: number };

export function buildTripTableColumns(columns: GoogleSheetColumn[]): Column<SheetTripRow>[] {
  return columns.map((col, index) => ({
    key: col.fieldKey,
    label: col.label,
    sortable: true,
    stickyLeft: index === 0,
    render: (value) => {
      if (value == null || value === '') {
        return <span className="text-zinc-300">—</span>;
      }
      if (isDurationColumnLabel(col.label)) {
        return <span className="tabular-nums">{formatDurationDisplay(value)}</span>;
      }
      return <span>{toDisplayString(value)}</span>;
    },
  }));
}

export function buildTripTableRows(
  sourceRows: Record<string, unknown>[],
): SheetTripRow[] {
  return sourceRows.map((row, index) => ({ _id: index, ...row }));
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
