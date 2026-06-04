/**
 * Google Visualization API JSON endpoint for a spreadsheet tab.
 * @see https://developers.google.com/chart/interactive/docs/querylanguage
 */
const GVIZ_JSON = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;

const MAX_ROW_LIMIT = 50_000;

/**
 * @param rowLimit — When set, caps the response to at most N rows.
 * @param recentFirst — When true, orders by column A descending so the cap returns the most
 *   recent rows rather than the oldest. Column A is SlNo (sequential integer) on all driving
 *   and shift sheets, so desc order gives the newest data. Use for large historical sheets
 *   where only recent months matter.
 */
export function buildGvizJsonUrl(sheetId: string, gid: string, rowLimit?: number, recentFirst?: boolean): string {
  const base = GVIZ_JSON(sheetId, gid);
  if (rowLimit == null || rowLimit <= 0) return base;
  const n = Math.min(Math.floor(rowLimit), MAX_ROW_LIMIT);
  const tq = recentFirst ? `select * order by A desc limit ${n}` : `select * limit ${n}`;
  return `${base}&tq=${encodeURIComponent(tq)}`;
}
