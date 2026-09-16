import { LOCATION_PAGE_SIZE, type LocationVehiclePage } from './locationVehicleData';

/** Fetch every bounded page before publishing a complete vehicle snapshot. */
export async function fetchCompleteLocationVehicleHistory(
  base: string,
  vehicle: string,
  scopes: string[],
  signal: AbortSignal,
  onProgress?: (recordCount: number) => void,
): Promise<LocationVehiclePage> {
  const rows: LocationVehiclePage['rows'] = [];
  let offset = 0;
  while (true) {
    signal.throwIfAborted();
    const response = await fetch(`${base}?${new URLSearchParams({
      mode: 'location-history', vehicle, scopes: JSON.stringify(scopes), offset: String(offset),
    })}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(55_000)]), cache: 'no-store' });
    const page = await response.json() as LocationVehiclePage & { error?: string };
    signal.throwIfAborted();
    if (!response.ok) throw new Error(page.error || 'Unable to load the complete vehicle history.');
    if (page.vehicle !== vehicle || page.offset !== offset || !Array.isArray(page.rows)
      || !Array.isArray(page.columns) || page.rows.length > LOCATION_PAGE_SIZE
      || typeof page.hasMore !== 'boolean' || (page.hasMore && page.rows.length === 0)) {
      throw new Error('Unable to load the complete vehicle history. Refresh and try again.');
    }
    rows.push(...page.rows);
    onProgress?.(rows.length);
    if (!page.hasMore) return { ...page, rows, offset: 0, hasMore: false };
    offset += page.rows.length;
    if (!Number.isSafeInteger(offset)) throw new Error('The vehicle history is too large to load.');
  }
}
