/**
 * Google Visualization API JSON endpoint for a spreadsheet tab.
 * @see https://developers.google.com/chart/interactive/docs/querylanguage
 */
const GVIZ_JSON = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;

const MAX_ROW_LIMIT = 50_000;

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

/**
 * @param rowLimit — When set, caps the response to at most N rows.
 * @param recentFirst — When true, orders by `orderColId` descending so the cap returns the most
 *   recent rows rather than the oldest. Use for large historical sheets where only recent months
 *   matter.
 * @param orderColId — Column reference (e.g. "D") to order by when recentFirst. Defaults to "A".
 *   IMPORTANT: column A (SlNo) is NOT globally sequential on all sheets — it resets/repeats on
 *   some customer sheets (e.g. ALCHEM cntDrv: 68 981 rows but SlNo maxes at 3 270), so ordering
 *   by A silently drops recent rows. Pass the sheet's timestamp column instead; see the sheets
 *   API proxy route which detects it.
 */
export function buildGvizJsonUrl(
  sheetId: string,
  gid: string,
  rowLimit?: number,
  recentFirst?: boolean,
  orderColId = 'A',
): string {
  const base = GVIZ_JSON(sheetId, gid);
  if (rowLimit == null || rowLimit <= 0) return base;
  const n = Math.min(Math.floor(rowLimit), MAX_ROW_LIMIT);
  const tq = recentFirst ? `select * order by ${orderColId} desc limit ${n}` : `select * limit ${n}`;
  return `${base}&tq=${encodeURIComponent(tq)}`;
}
