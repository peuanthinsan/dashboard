'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type GoogleSheetColumn,
  type GoogleSheetRow,
  parseGoogleSheetGvizText,
} from './googleSheetParse';
import {
  monthKeyToDateRange,
  SHEET_CHUNK_DAYS,
  splitDateRangeIntoChunks,
} from './googleSheetGvizUrl';

export type SheetMonthOption = {
  key: string;
  label: string;
  count: number;
};

type UseGoogleSheetOptions = {
  sheetId: string;
  gid: string;
  /** When false, skips fetch (for optional secondary tabs). */
  enabled?: boolean;
  /**
   * Month-scoped fetch mode (alert dashboards on large sheets):
   * - `undefined` — legacy "most recent 25k" (Driving / Video / etc.).
   * - `[]` — load the month catalogue only; wait for a selection before fetching rows.
   * - `['2026-06', …]` — fetch those months via 2-day chunks.
   */
  monthKeys?: string[];
  /**
   * When true (default if `monthKeys` is provided), also load the month catalogue
   * via `?mode=months` so the month picker lists months that aren't in the current
   * row window (e.g. April on a 245k-row sheet).
   */
  loadMonthCatalog?: boolean;
};

type SheetResponse = {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
  /** True only while the first payload is loading (no rows yet / initial mount). */
  loading: boolean;
  /** True while a month switch / refresh is in flight. */
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  /** Months present in the sheet (from mode=months). Empty when catalog not loaded. */
  availableMonths: SheetMonthOption[];
};

type CachedSheet = {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
  lastUpdated: number;
  availableMonths?: SheetMonthOption[];
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_CHARS = 2_000_000;
/** Bump when fetch semantics change (clear-on-switch / abort). */
const CACHE_VERSION = 'v6';
const memoryCache = new Map<string, CachedSheet>();
const catalogCache = new Map<string, { months: SheetMonthOption[]; fetchedAt: number }>();
const CHUNK_DAYS = SHEET_CHUNK_DAYS;
const FETCH_CONCURRENCY = 4;
/** Per-chunk timeout — hung GViz calls were leaving "Loading selected month…" forever. */
const CHUNK_TIMEOUT_MS = 45_000;

const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

const buildApiUrl = (sheetId: string, gid: string, query?: Record<string, string>) => {
  const base = `/api/sheets/${encodeURIComponent(sheetId)}/${encodeURIComponent(gid)}`;
  if (!query || Object.keys(query).length === 0) return base;
  const params = new URLSearchParams(query);
  return `${base}?${params.toString()}`;
};

const catalogCacheKey = (sheetId: string, gid: string) => `${sheetId}:${gid}`;

async function fetchWithTimeout(
  url: string,
  signal: AbortSignal,
  timeoutMs = CHUNK_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

export default function useGoogleSheet({
  sheetId,
  gid,
  enabled = true,
  monthKeys,
  loadMonthCatalog,
}: UseGoogleSheetOptions): SheetResponse {
  const monthScoped = monthKeys !== undefined;
  const wantCatalog = loadMonthCatalog ?? monthScoped;

  const [columns, setColumns] = useState<GoogleSheetColumn[]>([]);
  const [rows, setRows] = useState<GoogleSheetRow[]>([]);
  const [availableMonths, setAvailableMonths] = useState<SheetMonthOption[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const loadedMonthSigRef = useRef<string | null>(null);

  const monthKeySig = monthKeys ? [...monthKeys].sort().join(',') : '';
  const cacheKey = `${CACHE_VERSION}:${sheetId}:${gid}:months=${
    monthScoped ? (monthKeySig || 'NONE') : 'recent'
  }`;

  const readCache = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const cachedMemory = memoryCache.get(cacheKey);
    if (cachedMemory) {
      if (Date.now() - cachedMemory.lastUpdated <= CACHE_TTL_MS) return cachedMemory;
      memoryCache.delete(cacheKey);
    }
    let cached: string | null = null;
    try {
      cached = window.localStorage.getItem(`google-sheet:${cacheKey}`);
    } catch {
      return null;
    }
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached) as CachedSheet;
      if (!parsed?.lastUpdated || Date.now() - parsed.lastUpdated > CACHE_TTL_MS) {
        memoryCache.delete(cacheKey);
        window.localStorage.removeItem(`google-sheet:${cacheKey}`);
        return null;
      }
      memoryCache.set(cacheKey, parsed);
      return parsed;
    } catch {
      memoryCache.delete(cacheKey);
      window.localStorage.removeItem(`google-sheet:${cacheKey}`);
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    (payload: CachedSheet) => {
      if (typeof window === 'undefined') return;
      memoryCache.set(cacheKey, payload);
      const serialized = JSON.stringify(payload);
      if (serialized.length > MAX_CACHE_CHARS) return;
      try {
        window.localStorage.setItem(`google-sheet:${cacheKey}`, serialized);
      } catch {
        try {
          window.localStorage.removeItem(`google-sheet:${cacheKey}`);
        } catch {
          // Ignore storage failures.
        }
      }
    },
    [cacheKey],
  );

  const fetchMonthCatalog = useCallback(
    async (signal: AbortSignal): Promise<SheetMonthOption[]> => {
      const key = catalogCacheKey(sheetId, gid);
      const hit = catalogCache.get(key);
      if (hit && Date.now() - hit.fetchedAt <= CACHE_TTL_MS) return hit.months;

      const res = await fetchWithTimeout(buildApiUrl(sheetId, gid, { mode: 'months' }), signal);
      if (!res.ok) throw new Error('Unable to list sheet months.');
      const data = (await res.json()) as { months?: SheetMonthOption[] };
      const months = Array.isArray(data.months) ? data.months : [];
      catalogCache.set(key, { months, fetchedAt: Date.now() });
      return months;
    },
    [gid, sheetId],
  );

  const fetchDateChunk = useCallback(
    async (from: string, to: string, signal: AbortSignal): Promise<CachedSheet> => {
      const res = await fetchWithTimeout(buildApiUrl(sheetId, gid, { from, to }), signal);
      if (!res.ok) throw new Error('Unable to fetch the Google Sheet data.');
      const data = await res.json();
      return {
        columns: data.columns ?? [],
        rows: data.rows ?? [],
        lastUpdated: data.lastUpdated ?? Date.now(),
      };
    },
    [gid, sheetId],
  );

  const fetchMonths = useCallback(
    async (keys: string[], signal: AbortSignal): Promise<CachedSheet> => {
      const chunkJobs: Array<{ start: string; endExclusive: string }> = [];
      for (const key of keys) {
        const range = monthKeyToDateRange(key);
        if (!range) continue;
        chunkJobs.push(...splitDateRangeIntoChunks(range.start, range.endExclusive, CHUNK_DAYS));
      }

      const parts: CachedSheet[] = new Array(chunkJobs.length);
      let next = 0;
      async function worker() {
        while (next < chunkJobs.length) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const i = next++;
          const chunk = chunkJobs[i]!;
          parts[i] = await fetchDateChunk(chunk.start, chunk.endExclusive, signal);
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(FETCH_CONCURRENCY, Math.max(chunkJobs.length, 1)) },
          () => worker(),
        ),
      );

      let columnsAcc: GoogleSheetColumn[] = [];
      const rowsAcc: GoogleSheetRow[] = [];
      for (const part of parts) {
        if (!part) continue;
        if (columnsAcc.length === 0) columnsAcc = part.columns;
        rowsAcc.push(...part.rows);
      }
      return { columns: columnsAcc, rows: rowsAcc, lastUpdated: Date.now() };
    },
    [fetchDateChunk],
  );

  const fetchRecent = useCallback(
    async (signal: AbortSignal): Promise<CachedSheet> => {
      const tryFetch = async (url: string, isJson: boolean): Promise<CachedSheet> => {
        const response = await fetchWithTimeout(url, signal);
        if (!response.ok) throw new Error('Unable to fetch the Google Sheet data.');
        if (isJson) {
          const data = await response.json();
          return {
            columns: data.columns,
            rows: data.rows,
            lastUpdated: data.lastUpdated ?? Date.now(),
          };
        }
        const text = await response.text();
        const parsed = parseGoogleSheetGvizText(text);
        return {
          columns: parsed.columns,
          rows: parsed.rows,
          lastUpdated: Date.now(),
        };
      };
      try {
        return await tryFetch(buildApiUrl(sheetId, gid), true);
      } catch (err) {
        if (signal.aborted) throw err;
        return await tryFetch(buildSheetUrl(sheetId, gid), false);
      }
    },
    [gid, sheetId],
  );

  const applyPayload = useCallback((payload: CachedSheet, monthSig: string) => {
    setColumns(payload.columns);
    setRows(payload.rows);
    if (payload.availableMonths) setAvailableMonths(payload.availableMonths);
    setLastUpdated(new Date(payload.lastUpdated));
    loadedMonthSigRef.current = monthSig;
  }, []);

  const fetchSheet = useCallback(async () => {
    if (!enabled) {
      abortRef.current?.abort();
      setColumns([]);
      setRows([]);
      setAvailableMonths([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setLastUpdated(null);
      loadedMonthSigRef.current = null;
      return;
    }

    // Cancel any in-flight month fetch so a hung June load can't leave the UI stuck
    // after the user switches to May.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const gen = ++fetchGen.current;
    const targetSig = monthScoped ? monthKeySig || 'NONE' : 'recent';

    const cached = readCache();
    if (cached) {
      applyPayload(cached, targetSig);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    const switchingMonths =
      monthScoped &&
      loadedMonthSigRef.current !== null &&
      loadedMonthSigRef.current !== targetSig;

    // Drop stale rows immediately on month change so client-side month filters
    // don't zero out KPIs against the previous month's data (June rows + May filter).
    if (switchingMonths) {
      setRows([]);
      setColumns([]);
      setRefreshing(true);
      setLoading(false);
    } else if (loadedMonthSigRef.current === null) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      let months: SheetMonthOption[] = [];
      if (wantCatalog) {
        try {
          months = await fetchMonthCatalog(signal);
          if (gen !== fetchGen.current) return;
          setAvailableMonths(months);
        } catch (err) {
          if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
          months = [];
        }
      }

      if (monthScoped && (!monthKeys || monthKeys.length === 0)) {
        if (gen !== fetchGen.current) return;
        setRows([]);
        setColumns([]);
        setLastUpdated(new Date());
        // First visit with no month yet — keep loading until default month is set.
        if (loadedMonthSigRef.current === null) return;
        setRefreshing(false);
        setLoading(false);
        return;
      }

      const result = monthScoped
        ? await fetchMonths(monthKeys!, signal)
        : await fetchRecent(signal);
      if (gen !== fetchGen.current) return;

      const payload: CachedSheet = {
        ...result,
        availableMonths: months.length > 0 ? months : undefined,
      };
      applyPayload(payload, targetSig);
      writeCache(payload);
    } catch (err) {
      if (gen !== fetchGen.current) return;
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      const message = err instanceof Error ? err.message : 'Unable to fetch the Google Sheet data.';
      setError(message);
    } finally {
      if (gen === fetchGen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    applyPayload,
    enabled,
    fetchMonthCatalog,
    fetchMonths,
    fetchRecent,
    monthKeySig,
    monthKeys,
    monthScoped,
    readCache,
    wantCatalog,
    writeCache,
  ]);

  useEffect(() => {
    fetchSheet();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchSheet]);

  return {
    columns,
    rows,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh: fetchSheet,
    availableMonths,
  };
}
