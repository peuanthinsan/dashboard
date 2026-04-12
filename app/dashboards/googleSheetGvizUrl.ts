/**
 * Google Visualization API JSON endpoint for a spreadsheet tab.
 * @see https://developers.google.com/chart/interactive/docs/querylanguage
 */
const GVIZ_JSON = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;

const MAX_ROW_LIMIT = 50_000;

/**
 * @param rowLimit — When set, adds `tq=select * limit N` so the response stays small enough
 *   for serverless memory and avoids Next.js data cache >2MB failures. Use for metadata-only flows.
 */
export function buildGvizJsonUrl(sheetId: string, gid: string, rowLimit?: number): string {
  const base = GVIZ_JSON(sheetId, gid);
  if (rowLimit == null || rowLimit <= 0) return base;
  const n = Math.min(Math.floor(rowLimit), MAX_ROW_LIMIT);
  return `${base}&tq=${encodeURIComponent(`select * limit ${n}`)}`;
}
