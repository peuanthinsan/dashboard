/**
 * Google Visualization API JSON endpoint for a spreadsheet tab.
 * @see https://developers.google.com/chart/interactive/docs/querylanguage
 */
const GVIZ_JSON = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;

const MAX_ROW_LIMIT = 50_000;

/** Default cap for "most recent" fetches — keeps serverless responses under the working size. */
export const DEFAULT_SHEET_ROW_LIMIT = 25_000;

/**
 * Day-window size for month-scoped chunk fetches.
 * Full-row 7-day windows on PoonNok are ~16 MB (over Vercel's ~4.5 MB response limit).
 * 2-day pruned windows (with videoURL) stay ~2–3.5 MB even on dense May weeks.
 */
export const SHEET_CHUNK_DAYS = 2;

/**
 * Labels of columns alert dashboards actually read. Used to build a pruned GViz
 * `select` so date-range responses stay under the serverless payload limit.
 * Matched case-insensitively against the sheet's header row.
 */
export const ALERT_SHEET_COLUMN_LABELS = [
  'id',
  'SlNo',
  'Sl No',
  'Vehicle No',
  'Vehicle No TH',
  'Plate',
  'Driver Name',
  'Alert Type',
  'Alert Date Time',
  'Track Time',
  'Date',
  'DateTime',
  'Start Time',
  'Speed',
  'Max Speed',
  'Spd',
  'Over Speed',
  'OverSpeed',
  'videoURL',
  'Videoit',
  'Remarks',
  'Fleet',
  'User',
  'Location',
  'Address',
  'Landmark',
] as const;

/**
 * GViz/spreadsheet column reference for a zero-based column index:
 * 0 → "A", 25 → "Z", 26 → "AA". Used to build `order by <col>` clauses.
 */
export function gvizColumnLetter(index: number): string {
  let s = '';
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export type GvizQueryOptions = {
  /** Cap the response to at most N rows (clamped to MAX_ROW_LIMIT). */
  rowLimit?: number;
  /**
   * When true, orders by `orderColId` descending so the cap returns the most recent rows.
   * IMPORTANT: column A (SlNo) is NOT globally sequential on all sheets — pass the timestamp
   * column instead when available (see the sheets API proxy route).
   */
  recentFirst?: boolean;
  /** Column reference (e.g. "E") to order by when recentFirst. Defaults to "A". */
  orderColId?: string;
  /**
   * Optional GViz WHERE clause body (without the `where` keyword), e.g.
   * `A is not null and E >= date '2026-06-01' and E < date '2026-07-01'`.
   */
  where?: string;
  /** Optional SELECT clause body (without the `select` keyword). Defaults to `*`. */
  select?: string;
};

/**
 * Build a GViz JSON URL, optionally with a Query Language `tq` clause.
 */
export function buildGvizJsonUrl(
  sheetId: string,
  gid: string,
  rowLimitOrOptions?: number | GvizQueryOptions,
  recentFirst?: boolean,
  orderColId = 'A',
): string {
  const base = GVIZ_JSON(sheetId, gid);

  // Back-compat: buildGvizJsonUrl(id, gid, limit, recentFirst?, orderColId?)
  const options: GvizQueryOptions =
    typeof rowLimitOrOptions === 'object' && rowLimitOrOptions !== null
      ? rowLimitOrOptions
      : {
          rowLimit: rowLimitOrOptions,
          recentFirst,
          orderColId,
        };

  const select = (options.select?.trim() || '*').replace(/^select\s+/i, '');
  const whereBody = options.where?.trim().replace(/^where\s+/i, '') ?? '';
  const order = options.recentFirst
    ? `order by ${options.orderColId?.trim() || 'A'} desc`
    : '';
  const limit =
    options.rowLimit != null && options.rowLimit > 0
      ? `limit ${Math.min(Math.floor(options.rowLimit), MAX_ROW_LIMIT)}`
      : '';

  const parts = [`select ${select}`, whereBody ? `where ${whereBody}` : '', order, limit].filter(
    Boolean,
  );
  // No useful clause (just "select *") — omit tq entirely.
  if (parts.length === 1 && select === '*') return base;
  return `${base}&tq=${encodeURIComponent(parts.join(' '))}`;
}

/** YYYY-MM → { start: 'YYYY-MM-01', endExclusive: first day of next month }. */
export function monthKeyToDateRange(monthKey: string): { start: string; endExclusive: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, endExclusive };
}

/** Split [start, endExclusive) into contiguous day-sized chunks (default 7 days). */
export function splitDateRangeIntoChunks(
  startIso: string,
  endExclusiveIso: string,
  chunkDays = 7,
): Array<{ start: string; endExclusive: string }> {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endExclusiveIso);
  if (!start || !end || end <= start || chunkDays < 1) return [];

  const chunks: Array<{ start: string; endExclusive: string }> = [];
  let cursor = start;
  while (cursor < end) {
    const next = Math.min(cursor + chunkDays * 86_400_000, end);
    chunks.push({ start: formatIsoDate(cursor), endExclusive: formatIsoDate(next) });
    cursor = next;
  }
  return chunks;
}

/** GViz date literal: date 'YYYY-MM-DD'. */
export function gvizDateLiteral(isoDate: string): string {
  return `date '${isoDate}'`;
}

/**
 * WHERE body that keeps only rows with a non-null id column AND a timestamp in
 * [start, endExclusive). Excluding null ids drops poison rows that some sheets
 * carry with bogus future dates (PoonNok: ~40k null-id Aug–Dec rows that stole
 * the entire 25k "most recent" window).
 */
export function buildDatedRowsWhere(
  dateColId: string,
  startIso: string,
  endExclusiveIso: string,
  idColId = 'A',
): string {
  return (
    `${idColId} is not null` +
    ` and ${dateColId} >= ${gvizDateLiteral(startIso)}` +
    ` and ${dateColId} < ${gvizDateLiteral(endExclusiveIso)}`
  );
}

/** WHERE body: non-null id only (for recent-cap fetches that must ignore poison rows). */
export function buildNonNullIdWhere(idColId = 'A'): string {
  return `${idColId} is not null`;
}

/**
 * GViz query that lists calendar months present in a timestamp column.
 * GViz `month()` is 0-based (Jan=0); callers must add 1 when building YYYY-MM keys.
 */
export function buildMonthListQuery(dateColId: string, idColId = 'A'): string {
  return (
    `select year(${dateColId}), month(${dateColId}), count(${idColId})` +
    ` where ${idColId} is not null` +
    ` group by year(${dateColId}), month(${dateColId})`
  );
}

function parseIsoDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}

function formatIsoDate(utcMs: number): string {
  const d = new Date(utcMs);
  return (
    `${d.getUTCFullYear()}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getUTCDate()).padStart(2, '0')}`
  );
}
