import {
  buildDatedRowsWhere,
  buildGvizJsonUrl,
  buildMonthListQuery,
  buildNonNullIdWhere,
  DEFAULT_SHEET_ROW_LIMIT,
  gvizColumnLetter,
  monthKeyToDateRange,
  splitDateRangeIntoChunks,
} from './googleSheetGvizUrl';
import {
  type GoogleSheetColumn,
  type GoogleSheetRow,
  parseGoogleSheetGvizText,
} from './googleSheetParse';

const UA = { 'User-Agent': 'SongdeeGPS-Dashboard/1.0' } as const;

export type SheetMonthOption = {
  /** YYYY-MM */
  key: string;
  label: string;
  count: number;
};

export type SheetFetchResult = {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
};

function gvizBase(sheetId: string, gid: string): string {
  return (
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq` +
    `?tqx=out:json&gid=${encodeURIComponent(gid)}`
  );
}

/** Detect the first date/datetime-typed column; fall back to "A". */
export async function detectSheetDateColumn(
  sheetId: string,
  gid: string,
): Promise<{ orderColId: string; columns: GoogleSheetColumn[] }> {
  const meta = await fetch(buildGvizJsonUrl(sheetId, gid, { rowLimit: 1 }), {
    headers: UA,
    cache: 'no-store',
  });
  if (!meta.ok) {
    return { orderColId: 'A', columns: [] };
  }
  const parsed = parseGoogleSheetGvizText(await meta.text());
  const dateIdx = parsed.columns.findIndex((c) => c.type === 'datetime' || c.type === 'date');
  return {
    orderColId: dateIdx >= 0 ? gvizColumnLetter(dateIdx) : 'A',
    columns: parsed.columns,
  };
}

/**
 * List calendar months present in the sheet (non-null id rows only).
 * GViz month() is 0-based — we add 1 when building YYYY-MM keys.
 */
export async function listSheetMonths(sheetId: string, gid: string): Promise<SheetMonthOption[]> {
  const { orderColId } = await detectSheetDateColumn(sheetId, gid);
  if (orderColId === 'A') return [];

  const url = `${gvizBase(sheetId, gid)}&tq=${encodeURIComponent(buildMonthListQuery(orderColId))}`;
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to list sheet months.');
  const parsed = parseGoogleSheetGvizText(await res.text());

  const months: SheetMonthOption[] = [];
  for (const row of parsed.rows) {
    // year()/month()/count() produce unlabeled cols → fieldKeys "Column 1"…
    const values = Object.values(row);
    const year = Number(values[0]);
    const month0 = Number(values[1]);
    const count = Number(values[2]) || 0;
    if (!Number.isFinite(year) || !Number.isFinite(month0) || count <= 0) continue;
    const month = month0 + 1;
    if (month < 1 || month > 12) continue;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-GB', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    months.push({ key, label, count });
  }
  return months.sort((a, b) => b.key.localeCompare(a.key));
}

/** Most-recent rows, excluding null-id poison rows that steal the cap window. */
export async function fetchRecentSheetRows(
  sheetId: string,
  gid: string,
  rowLimit = DEFAULT_SHEET_ROW_LIMIT,
): Promise<SheetFetchResult> {
  const { orderColId } = await detectSheetDateColumn(sheetId, gid);
  const url = buildGvizJsonUrl(sheetId, gid, {
    rowLimit,
    recentFirst: true,
    orderColId,
    where: buildNonNullIdWhere('A'),
  });
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to fetch the Google Sheet data.');
  return parseGoogleSheetGvizText(await res.text());
}

/**
 * Fetch rows in [fromIso, toIso) with a non-null id, capped at rowLimit.
 * Keep the window ≤ ~7 days on high-volume alert sheets so the response stays under ~20 MB.
 */
export async function fetchSheetDateRange(
  sheetId: string,
  gid: string,
  fromIso: string,
  toIso: string,
  rowLimit = DEFAULT_SHEET_ROW_LIMIT,
): Promise<SheetFetchResult> {
  const { orderColId } = await detectSheetDateColumn(sheetId, gid);
  if (orderColId === 'A') {
    return fetchRecentSheetRows(sheetId, gid, rowLimit);
  }
  const url = buildGvizJsonUrl(sheetId, gid, {
    rowLimit,
    where: buildDatedRowsWhere(orderColId, fromIso, toIso, 'A'),
  });
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to fetch the Google Sheet data.');
  return parseGoogleSheetGvizText(await res.text());
}

/** Week-chunk a calendar month and merge (server-side helper; prefer client chunking for large months). */
export async function fetchSheetMonth(
  sheetId: string,
  gid: string,
  monthKey: string,
  chunkDays = 7,
): Promise<SheetFetchResult> {
  const range = monthKeyToDateRange(monthKey);
  if (!range) throw new Error(`Invalid month key: ${monthKey}`);
  const chunks = splitDateRangeIntoChunks(range.start, range.endExclusive, chunkDays);
  let columns: GoogleSheetColumn[] = [];
  const rows: GoogleSheetRow[] = [];
  for (const chunk of chunks) {
    const part = await fetchSheetDateRange(sheetId, gid, chunk.start, chunk.endExclusive);
    if (columns.length === 0) columns = part.columns;
    rows.push(...part.rows);
  }
  return { columns, rows };
}
