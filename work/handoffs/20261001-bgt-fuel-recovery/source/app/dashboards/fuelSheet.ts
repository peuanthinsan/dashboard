import { parseGoogleSheetTable } from './googleSheetParse';

/** Fuel telemetry must retain all columns and rows; alert queries are not applicable. */
export function parseFuelSheet(payload: string) {
  const match = payload.match(/setResponse\(([\s\S]*)\);/);
  if (!match) throw new Error('The fuel sheet did not return readable data. Check sharing access.');
  const envelope = JSON.parse(match[1]) as Parameters<typeof parseGoogleSheetTable>[0] & { status?: string };
  if (envelope.status === 'error' || !envelope.table) throw new Error('Unable to read the fuel sheet. Check sharing access.');
  const parsed = parseGoogleSheetTable(envelope);
  const labels = new Set(parsed.columns.map((column) => column.label.toLowerCase().trim()));
  const missing = ['Vehicle No', 'Date Time', 'Total Fuel'].filter((label) => !labels.has(label.toLowerCase()));
  if (missing.length) throw new Error(`Missing fuel columns: ${missing.join(', ')}.`);
  return parsed;
}

export async function loadFuelSheet(sheetId: string, gid: string, signal: AbortSignal) {
  const params = new URLSearchParams({ tqx: 'out:json', headers: '1', gid });
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`, {
    cache: 'no-store', signal,
  });
  if (!response.ok) throw new Error('Unable to load the fuel sheet. Check sharing access and retry.');
  return parseFuelSheet(await response.text());
}
