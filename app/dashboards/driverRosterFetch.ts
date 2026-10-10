import { parseGoogleSheetGvizText } from './googleSheetParse';
import { parseDriverRoster, validateDriverRosterSettings, type DriverRosterSettings } from './driverRoster';

const MAX_ROSTER_ROWS = 10_000;
/** Read a complete, small roster. Never turn a failed/truncated response into zero-alert drivers. */
export async function fetchDriverRoster(settings: DriverRosterSettings, signal?: AbortSignal) {
  const source = validateDriverRosterSettings(settings);
  const query = new URLSearchParams({ gid: source.sheetGid, headers: '1', tqx: 'out:json', tq: `select * limit ${MAX_ROSTER_ROWS + 1}` });
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${source.sheetId}/gviz/tq?${query}`, {
    cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new Error('Unable to read the roster sheet. Check its link and access.');
  const parsed = parseGoogleSheetGvizText(await response.text());
  if (parsed.rows.length > MAX_ROSTER_ROWS) throw new Error('The roster is too large to load completely. Use a dedicated roster tab.');
  return parseDriverRoster(parsed.columns, parsed.rows, source.defaultFleet);
}
