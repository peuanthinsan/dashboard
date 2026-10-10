import { assertAfterHoursColumns } from './afterHoursEntry';
import { parseGoogleSheetGvizText } from './googleSheetParse';

export const AFTER_HOURS_PAGE_SIZE = 1000;

/** Page in source order: typed GViz date predicates would misread the FMS dd/MM display. */
export async function fetchAfterHoursPage(sheetId: string, gid: string, offset: number, signal?: AbortSignal) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid sheet offset.');
  const query = new URLSearchParams({ gid, headers: '1', tqx: 'out:json',
    tq: `select * limit ${AFTER_HOURS_PAGE_SIZE + 1} offset ${offset}` });
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${query}`, {
    cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new Error('Unable to load the Google Sheet. Check its sharing settings and link.');
  const parsed = parseGoogleSheetGvizText(await response.text());
  assertAfterHoursColumns(parsed.columns);
  return { rows: parsed.rows.slice(0, AFTER_HOURS_PAGE_SIZE), hasMore: parsed.rows.length > AFTER_HOURS_PAGE_SIZE,
    nextOffset: offset + AFTER_HOURS_PAGE_SIZE };
}
