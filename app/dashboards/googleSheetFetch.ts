import {
  ALERT_SHEET_COLUMN_LABELS,
  buildDatedRowsWhere,
  buildGvizJsonUrl,
  buildMonthListQuery,
  buildNonNullIdWhere,
  DEFAULT_SHEET_ROW_LIMIT,
  gvizColumnLetter,
  monthKeyToDateRange,
  SHEET_CHUNK_DAYS,
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

type DetectedSheetMeta = { orderColId: string; columns: GoogleSheetColumn[] };

// Detection costs a full GViz round-trip (~10s on large sheets) and the answer is
// stable, so cache it per sheet. On Vercel, warm function instances reuse this map,
// halving the latency of every chunked date-range request.
const detectCache = new Map<string, { meta: DetectedSheetMeta; fetchedAt: number }>();
const DETECT_TTL_MS = 10 * 60 * 1000;

/** Detect the first date/datetime-typed column; fall back to "A". Cached per sheet. */
export async function detectSheetDateColumn(
  sheetId: string,
  gid: string,
): Promise<DetectedSheetMeta> {
  const key = `${sheetId}:${gid}`;
  const hit = detectCache.get(key);
  if (hit && Date.now() - hit.fetchedAt <= DETECT_TTL_MS) return hit.meta;

  const meta = await fetch(buildGvizJsonUrl(sheetId, gid, { rowLimit: 1 }), {
    headers: UA,
    cache: 'no-store',
  });
  if (!meta.ok) {
    return { orderColId: 'A', columns: [] };
  }
  const parsed = parseGoogleSheetGvizText(await meta.text());
  const dateIdx = parsed.columns.findIndex((c) => c.type === 'datetime' || c.type === 'date');
  const result: DetectedSheetMeta = {
    orderColId: dateIdx >= 0 ? gvizColumnLetter(dateIdx) : 'A',
    columns: parsed.columns,
  };
  if (result.columns.length > 0) {
    detectCache.set(key, { meta: result, fetchedAt: Date.now() });
  }
  return result;
}

/**
 * Build a GViz `select` of column letters for headers that match ALERT_SHEET_COLUMN_LABELS.
 * Always includes column A (id) so the null-id poison filter still works.
 * Falls back to `*` when nothing matches (unknown sheet shape).
 *
 * Omits videoURL by default — those cells are long URLs that push dense 2–3 day
 * windows over Vercel's ~4.5 MB response limit. Detail's video evidence is empty
 * for month-scoped loads on huge sheets; Summary/Simple/OverSpeed don't need it.
 */
export function buildAlertColumnSelect(columns: GoogleSheetColumn[]): string {
  const wanted = new Set(ALERT_SHEET_COLUMN_LABELS.map((l) => l.trim().toLowerCase()));
  // Drop video columns from the prune set — too large for dense chunks.
  wanted.delete('videourl');
  wanted.delete('videoit');

  const letters: string[] = [];
  const seen = new Set<string>();
  columns.forEach((col, index) => {
    const letter = gvizColumnLetter(index);
    if (index === 0) {
      letters.push(letter);
      seen.add(letter);
      return;
    }
    if (wanted.has(col.label.trim().toLowerCase()) && !seen.has(letter)) {
      letters.push(letter);
      seen.add(letter);
    }
  });
  return letters.length > 1 ? letters.join(',') : '*';
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
    // year()/month()/count() produce labeled cols like "year(Alert Date Time)".
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
  const { orderColId, columns } = await detectSheetDateColumn(sheetId, gid);
  const select = buildAlertColumnSelect(columns);
  const url = buildGvizJsonUrl(sheetId, gid, {
    rowLimit,
    recentFirst: true,
    orderColId,
    where: buildNonNullIdWhere('A'),
    select,
  });
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to fetch the Google Sheet data.');
  return parseGoogleSheetGvizText(await res.text());
}

/**
 * Fetch rows in [fromIso, toIso) with a non-null id, capped at rowLimit.
 * Columns are pruned to ALERT_SHEET_COLUMN_LABELS so dense windows stay under ~4.5 MB.
 */
export async function fetchSheetDateRange(
  sheetId: string,
  gid: string,
  fromIso: string,
  toIso: string,
  rowLimit = DEFAULT_SHEET_ROW_LIMIT,
): Promise<SheetFetchResult> {
  const { orderColId, columns } = await detectSheetDateColumn(sheetId, gid);
  if (orderColId === 'A') {
    return fetchRecentSheetRows(sheetId, gid, rowLimit);
  }
  const select = buildAlertColumnSelect(columns);
  const url = buildGvizJsonUrl(sheetId, gid, {
    rowLimit,
    where: buildDatedRowsWhere(orderColId, fromIso, toIso, 'A'),
    select,
  });
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to fetch the Google Sheet data.');
  return parseGoogleSheetGvizText(await res.text());
}

/** Chunk a calendar month and merge (server-side helper; prefer client chunking). */
export async function fetchSheetMonth(
  sheetId: string,
  gid: string,
  monthKey: string,
  chunkDays = SHEET_CHUNK_DAYS,
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
