import { buildGvizJsonUrl } from './googleSheetGvizUrl';
import { parseGoogleSheetGvizText } from './googleSheetParse';
import { isSimpleSummarySheet } from './simpleSummaryData';

export type SimpleSheetResult =
  | { kind: 'raw' }
  | ({ kind: 'summary'; lastUpdated: Date } & ReturnType<typeof parseGoogleSheetGvizText>);

async function readSheet(url: string, signal: AbortSignal, timeoutMs: number) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  });
  if (!response.ok) throw new Error('Unable to load the monthly summary. Check sheet access and retry.');
  const payload = parseGoogleSheetGvizText(await response.text());
  if (payload.columns.length === 0) throw new Error('The sheet did not return readable columns. Check sheet access and retry.');
  return payload;
}

/** Probe cheaply; raw sheets retain their existing proxy, cache and month fetches. */
export async function loadSimpleSheet(sheetId: string, gid: string, signal: AbortSignal): Promise<SimpleSheetResult> {
  try {
    const header = await readSheet(`${buildGvizJsonUrl(sheetId, gid, { rowLimit: 1 })}&headers=1`, signal, 5_000);
    signal.throwIfAborted();
    if (!isSimpleSummarySheet(header.columns)) return { kind: 'raw' };
  } catch (error) {
    if (signal.aborted) throw error;
    // Preserve raw dashboards that rely on their proxy/cache when direct access fails.
    return { kind: 'raw' };
  }
  // Summary sheets are already small: no event-column pruning, date windows or
  // recent-row cap. After detection, failures stay visible instead of going raw.
  try {
    const payload = await readSheet(`${buildGvizJsonUrl(sheetId, gid)}&headers=1`, signal, 30_000);
    signal.throwIfAborted();
    return { kind: 'summary', ...payload, lastUpdated: new Date() };
  } catch (error) {
    if (!signal.aborted && error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Loading the monthly summary timed out. Please retry.');
    }
    throw error;
  }
}
