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
/** Bump when fetch semantics change (timeout vs abort, no empty-cache). */
const CACHE_VERSION = 'v7';
const memoryCache = new Map<string, CachedSheet>();
const catalogCache = new Map<string, { months: SheetMonthOption[]; fetchedAt: number }>();
const CHUNK_DAYS = SHEET_CHUNK_DAYS;
const FETCH_CONCURRENCY = 4;
/** Per-chunk timeout. Dense May/June windows can take 20–30s through the proxy. */
const CHUNK_TIMEOUT_MS = 60_000;

class ChunkTimeoutError extends Error {
  constructor(message = 'Sheet chunk request timed out') {
    super(message);
    this.name = 'ChunkTimeoutError';
  }
}

const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

const buildApiUrl = (sheetId: string, gid: string, query?: Record<string, string>) => {
  const base = `/api/sheets/${encodeURIComponent(sheetId)}/${encodeURIComponent(gid)}`;
  if (!query || Object.keys(query).length === 0) return base;
  const params = new URLSearchParams(query);
  return `${base}?${params.toString()}`;
};

const catalogCacheKey = (sheetId: string, gid: string) => `${sheetId}:${gid}`;

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

/**
 * Fetch with a per-request timeout that is DISTINCT from parent cancellation.
 * Parent abort → AbortError (silent cancel). Timer fire → ChunkTimeoutError (surface to UI).
 */
async function fetchWithTimeout(
  url: string,
  parentSignal: AbortSignal,
  timeoutMs = CHUNK_TIMEOUT_MS,
): Promise<Response> {
  if (parentSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener('abort', onParentAbort);

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new ChunkTimeoutError();
    if (parentSignal.aborted || isAbortError(err)) {
      throw new DOMException('Aborted', 'AbortError');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener('abort', onParentAbort);
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
      // Never treat an empty month payload as a hit — it is almost always a
      // failed/aborted fetch that got written before v7, and it locks the UI at 0.
      if (
        cachedMemory.rows.length === 0 &&
        monthScoped &&
        monthKeySig &&
        monthKeySig !== 'NONE'
      ) {
        memoryCache.delete(cacheKey);
      } else if (Date.now() - cachedMemory.lastUpdated <= CACHE_TTL_MS) {
        return cachedMemory;
      } else {
        memoryCache.delete(cacheKey);
      }
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
      if (parsed.rows.length === 0 && monthScoped && monthKeySig && monthKeySig !== 'NONE') {
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
  }, [cacheKey, monthKeySig, monthScoped]);

  const writeCache = useCallback(
    (payload: CachedSheet) => {
      if (typeof window === 'undefined') return;
      // Do not persist empty month fetches — they poison the next load with zeros.
      if (payload.rows.length === 0 && monthScoped) return;
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
    [cacheKey, monthScoped],
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
      // Fetch one calendar month at a time so a timeout in June doesn't wipe April/May,
      // and so multi-month selections (Apr+May+Jun ≈ 45 chunks) stay manageable.
      let columnsAcc: GoogleSheetColumn[] = [];
      const rowsAcc: GoogleSheetRow[] = [];

      for (const key of keys) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const range = monthKeyToDateRange(key);
        if (!range) continue;
        const chunkJobs = splitDateRangeIntoChunks(range.start, range.endExclusive, CHUNK_DAYS);
        const parts: CachedSheet[] = new Array(chunkJobs.length);
        let next = 0;
        const worker = async () => {
          while (next < chunkJobs.length) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const i = next++;
            const chunk = chunkJobs[i]!;
            parts[i] = await fetchDateChunk(chunk.start, chunk.endExclusive, signal);
          }
        };
        await Promise.all(
          Array.from(
            { length: Math.min(FETCH_CONCURRENCY, Math.max(chunkJobs.length, 1)) },
            () => worker(),
          ),
        );
        for (const part of parts) {
          if (!part) continue;
          if (columnsAcc.length === 0) columnsAcc = part.columns;
          rowsAcc.push(...part.rows);
        }
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
        if (signal.aborted || isAbortError(err)) throw err;
        if (err instanceof ChunkTimeoutError) throw err;
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
          if (signal.aborted || isAbortError(err)) return;
          if (err instanceof ChunkTimeoutError) {
            // Catalogue timeout is non-fatal if we can still load rows.
            months = [];
          } else {
            months = [];
          }
        }
      }

      if (monthScoped && (!monthKeys || monthKeys.length === 0)) {
        if (gen !== fetchGen.current) return;
        setRows([]);
        setColumns([]);
        setLastUpdated(new Date());
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
      // Only swallow aborts from a newer month selection replacing this one.
      if (signal.aborted || isAbortError(err)) return;
      const message =
        err instanceof ChunkTimeoutError
          ? 'Loading timed out — try fewer months, or retry.'
          : err instanceof Error
            ? err.message
            : 'Unable to fetch the Google Sheet data.';
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
