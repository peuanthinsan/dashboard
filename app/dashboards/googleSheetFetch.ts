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
import { currentMonthKey } from './dashboardDataUtils';

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

type DetectedSheetMeta = {
  orderColId: string;
  /** True when the sheet has a real date/datetime-typed column to scope by. */
  hasDateColumn: boolean;
  columns: GoogleSheetColumn[];
};

/**
 * Thrown when a date-scoped fetch is requested on a sheet with no date-typed
 * column. Callers must fall back to the legacy most-recent window instead of
 * silently receiving unrelated rows (a from/to caller merging chunked responses
 * would otherwise duplicate the same 25k rows once per chunk).
 */
export class SheetDateColumnError extends Error {
  constructor(message = 'Sheet has no date-typed column; month-scoped fetch unsupported.') {
    super(message);
    this.name = 'SheetDateColumnError';
  }
}

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
    // Header unavailable (transient) — NOT the same as "no date column".
    return { orderColId: 'A', hasDateColumn: false, columns: [] };
  }
  const parsed = parseGoogleSheetGvizText(await meta.text());
  const dateIdx = parsed.columns.findIndex((c) => c.type === 'datetime' || c.type === 'date');
  const result: DetectedSheetMeta = {
    orderColId: dateIdx >= 0 ? gvizColumnLetter(dateIdx) : 'A',
    hasDateColumn: dateIdx >= 0,
    columns: parsed.columns,
  };
  if (result.columns.length > 0) {
    detectCache.set(key, { meta: result, fetchedAt: Date.now() });
  }
  return result;
}

export type AlertColumnSelectOptions = {
  /**
   * Keep videoURL/Videoit in the pruned select. Only Detail renders video
   * evidence — Summary/Simple/OverSpeed don't, so they skip it by default to
   * leave more headroom under Vercel's ~4.5 MB response limit on dense chunks.
   */
  includeVideo?: boolean;
};

/**
 * Build a GViz `select` of column letters for headers that match ALERT_SHEET_COLUMN_LABELS.
 * Always includes column A (id) so the null-id poison filter still works.
 * Falls back to `*` when nothing matches (unknown sheet shape).
 *
 * Omits videoURL unless `includeVideo` is set — those cells are long URLs that
 * push dense 2–3 day windows closer to Vercel's ~4.5 MB response limit.
 */
export function buildAlertColumnSelect(
  columns: GoogleSheetColumn[],
  options?: AlertColumnSelectOptions,
): string {
  const wanted = new Set(ALERT_SHEET_COLUMN_LABELS.map((l) => l.trim().toLowerCase()));
  if (!options?.includeVideo) {
    wanted.delete('videourl');
    wanted.delete('videoit');
  }

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
 * Months after the current Bangkok calendar month are dropped — a few sheets
 * carry poison future-dated rows (e.g. AirliquideTH Sep–Nov 2026) that would
 * otherwise become the default "newest" month in the picker.
 */
export async function listSheetMonths(
  sheetId: string,
  gid: string,
  now: Date = new Date(),
): Promise<SheetMonthOption[]> {
  const { orderColId, hasDateColumn } = await detectSheetDateColumn(sheetId, gid);
  if (!hasDateColumn) return [];

  const url = `${gvizBase(sheetId, gid)}&tq=${encodeURIComponent(buildMonthListQuery(orderColId))}`;
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to list sheet months.');
  const parsed = parseGoogleSheetGvizText(await res.text());

  const maxKey = currentMonthKey(now);
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
    if (key > maxKey) continue;
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-GB', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    months.push({ key, label, count });
  }
  return months.sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Most-recent rows, excluding null-id poison rows that steal the cap window.
 *
 * Returns FULL columns deliberately: this path serves the legacy (non-month-scoped)
 * templates — Driving, Video, unit-status, DynamicTrip — whose sheets share a few
 * alert-style headers but whose data lives in columns OUTSIDE the alert set
 * (Login/Logout/WorkHrs, videoURL, GPS Status, trip coordinates…). Pruning here
 * silently strips those columns. Prune only date-range chunk fetches.
 */
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
 * Columns are pruned to ALERT_SHEET_COLUMN_LABELS so dense windows stay under ~4.5 MB.
 */
export async function fetchSheetDateRange(
  sheetId: string,
  gid: string,
  fromIso: string,
  toIso: string,
  rowLimit = DEFAULT_SHEET_ROW_LIMIT,
  options?: AlertColumnSelectOptions,
): Promise<SheetFetchResult> {
  const { orderColId, columns, hasDateColumn } = await detectSheetDateColumn(sheetId, gid);
  if (!hasDateColumn) {
    if (columns.length === 0) {
      // Header fetch failed — surface as retryable, not as a schema problem.
      throw new Error('Unable to read the sheet header.');
    }
    throw new SheetDateColumnError();
  }
  const select = buildAlertColumnSelect(columns, options);
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
  options?: AlertColumnSelectOptions,
): Promise<SheetFetchResult> {
  const range = monthKeyToDateRange(monthKey);
  if (!range) throw new Error(`Invalid month key: ${monthKey}`);
  const chunks = splitDateRangeIntoChunks(range.start, range.endExclusive, chunkDays);
  let columns: GoogleSheetColumn[] = [];
  const rows: GoogleSheetRow[] = [];
  for (const chunk of chunks) {
    const part = await fetchSheetDateRange(
      sheetId,
      gid,
      chunk.start,
      chunk.endExclusive,
      DEFAULT_SHEET_ROW_LIMIT,
      options,
    );
    if (columns.length === 0) columns = part.columns;
    rows.push(...part.rows);
  }
  return { columns, rows };
}
