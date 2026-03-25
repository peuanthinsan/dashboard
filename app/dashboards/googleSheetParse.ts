export type GoogleSheetColumn = {
  label: string;
  type: string;
  /** Stable unique key for row objects (differs from label when headers repeat). */
  fieldKey: string;
};

export type GoogleSheetRow = Record<string, string | number | boolean | null>;

type ColJson = { label?: string; type?: string };
type RowJson = { c?: Array<{ f?: unknown; v?: unknown } | null> };

export function assignUniqueFieldKeys(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return n === 1 ? label : `${label} (${n})`;
  });
}

export function parseGoogleSheetTable(json: { table?: { cols?: ColJson[]; rows?: RowJson[] } }): {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
} {
  const rawCols = json.table?.cols ?? [];
  const displayLabels = rawCols.map((col, index) =>
    col?.label ? String(col.label).trim() : `Column ${index + 1}`,
  );
  const fieldKeys = assignUniqueFieldKeys(displayLabels);
  const columns: GoogleSheetColumn[] = rawCols.map((col, index) => ({
    label: displayLabels[index]!,
    type: col?.type ?? 'string',
    fieldKey: fieldKeys[index]!,
  }));

  const rows: GoogleSheetRow[] = (json.table?.rows ?? []).map((row) => {
    const record: GoogleSheetRow = {};
    (row?.c ?? []).forEach((cell, index) => {
      const column = columns[index];
      if (!column) return;
      record[column.fieldKey] = (cell?.f ?? cell?.v ?? null) as string | number | boolean | null;
    });
    return record;
  });

  const isHeaderRow = (row: GoogleSheetRow) =>
    columns.length > 0 &&
    columns.every((column) => String(row[column.fieldKey] ?? '').trim() === column.label);

  const trimmedRows = rows.length > 0 && isHeaderRow(rows[0]!) ? rows.slice(1) : rows;
  return { columns, rows: trimmedRows };
}

export function parseGoogleSheetGvizText(payload: string): {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
} {
  const match = payload.match(/setResponse\(([\s\S]*)\);/);
  if (!match) {
    throw new Error('Unable to read the Google Sheet response.');
  }
  const json = JSON.parse(match[1]) as { table?: { cols?: ColJson[]; rows?: RowJson[] } };
  return parseGoogleSheetTable(json);
}
