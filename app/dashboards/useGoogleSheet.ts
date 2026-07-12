'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type GoogleSheetColumn,
  type GoogleSheetRow,
  parseGoogleSheetGvizText,
} from './googleSheetParse';
import {
  buildDatedRowsWhere,
  buildGvizJsonUrl,
  gvizColumnLetter,
  monthKeyToDateRange,
  splitDateRangeIntoChunks,
} from './googleSheetGvizUrl';
import { buildAlertColumnSelect } from './googleSheetFetch';

export type SheetMonthOption = {
  key: string;
  label: string;
  count: number;
};

export type SheetLoadProgress = {
  done: number;
  total: number;
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
   * - `['2026-06', …]` — fetch those months in chunks, rendered progressively.
   * Sheets that can't serve month scoping (no date-typed column, empty/failed
   * catalogue) automatically fall back to the legacy most-recent window.
   */
  monthKeys?: string[];
  /**
   * When true (default if `monthKeys` is provided), also load the month catalogue
   * via `?mode=months` so the month picker lists months that aren't in the current
   * row window (e.g. April on a 245k-row sheet).
   */
  loadMonthCatalog?: boolean;
  /**
   * Keep videoURL/Videoit in month-scoped chunk fetches. Only Detail renders
   * video evidence — leave this off elsewhere so chunks stay smaller.
   */
  includeVideo?: boolean;
};

type SheetResponse = {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
  /** True while there is nothing to render yet (first paint). */
  loading: boolean;
  /** True while more chunks are still arriving; partial rows are already visible. */
  refreshing: boolean;
  /** Chunk progress for the current month load (null when idle). */
  progress: SheetLoadProgress | null;
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

type SheetMeta = { orderColId: string; select: string; hasDateColumn: boolean };

const CACHE_TTL_MS = 5 * 60 * 1000;
const CATALOG_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_CHARS = 2_000_000;
/** Bump when fetch semantics change (direct GViz chunks + progressive apply). */
const CACHE_VERSION = 'v9';
/** Cap on distinct in-memory cached sheets; each can hold a full multi-MB row array, so
 *  an unbounded Map grows for the tab's lifetime as the user steps through months/dashboards. */
const MAX_MEMORY_CACHE_ENTRIES = 12;
const memoryCache = new Map<string, CachedSheet>();
const catalogCache = new Map<string, { months: SheetMonthOption[]; fetchedAt: number }>();
const metaCache = new Map<string, { meta: SheetMeta; fetchedAt: number }>();
/** Sheets where direct browser→GViz failed (CORS/permission); use the proxy instead. */
const directBroken = new Set<string>();
/**
 * Sheets where month-scoped fetching cannot work (no date-typed column, or the
 * month catalogue is empty). These fall back to the legacy most-recent window so
 * the dashboard never renders permanently blank; templates' client-side month
 * filters still apply to the fallback rows.
 */
const monthScopeUnsupported = new Set<string>();

/**
 * Direct browser→GViz chunks skip the Vercel proxy (no ~4.5 MB response cap and no
 * serverless hop), so they can be week-sized: 5 requests per month instead of 15.
 */
const DIRECT_CHUNK_DAYS = 7;
/** Proxy fallback chunks must stay under the serverless payload limit (≤4-day guard). */
const PROXY_CHUNK_DAYS = 3;
const FETCH_CONCURRENCY = 5;
const CHUNK_TIMEOUT_MS = 60_000;

class ChunkTimeoutError extends Error {
  constructor(message = 'Sheet chunk request timed out') {
    super(message);
    this.name = 'ChunkTimeoutError';
  }
}

/** The sheet cannot serve date-scoped chunks (no date-typed column). */
class MonthScopeUnsupportedError extends Error {
  constructor(message = 'Month-scoped fetch unsupported for this sheet') {
    super(message);
    this.name = 'MonthScopeUnsupportedError';
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

const sheetKey = (sheetId: string, gid: string) => `${sheetId}:${gid}`;

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

/**
 * Detect the timestamp column + pruned select directly from GViz. Cached per
 * sheet AND per `includeVideo` — the same sheet/gid can be fetched by both a
 * Detail dashboard (needs video) and a Summary/Simple/OverSpeed dashboard
 * (doesn't) with different pruned selects, so the cache must not conflate them.
 */
async function getSheetMeta(
  sheetId: string,
  gid: string,
  signal: AbortSignal,
  includeVideo: boolean,
): Promise<SheetMeta> {
  const key = `${sheetKey(sheetId, gid)}:video=${includeVideo}`;
  const hit = metaCache.get(key);
  if (hit && Date.now() - hit.fetchedAt <= CATALOG_TTL_MS) return hit.meta;

  const res = await fetchWithTimeout(
    buildGvizJsonUrl(sheetId, gid, { rowLimit: 1 }),
    signal,
  );
  if (!res.ok) throw new Error('Unable to read the sheet header.');
  const parsed = parseGoogleSheetGvizText(await res.text());
  const dateIdx = parsed.columns.findIndex((c) => c.type === 'datetime' || c.type === 'date');
  const meta: SheetMeta = {
    orderColId: dateIdx >= 0 ? gvizColumnLetter(dateIdx) : 'A',
    select: buildAlertColumnSelect(parsed.columns, { includeVideo }),
    hasDateColumn: dateIdx >= 0,
  };
  metaCache.set(key, { meta, fetchedAt: Date.now() });
  return meta;
}

export default function useGoogleSheet({
  sheetId,
  gid,
  enabled = true,
  monthKeys,
  loadMonthCatalog,
  includeVideo = false,
}: UseGoogleSheetOptions): SheetResponse {
  const monthScoped = monthKeys !== undefined;
  const wantCatalog = loadMonthCatalog ?? monthScoped;

  const [columns, setColumns] = useState<GoogleSheetColumn[]>([]);
  const [rows, setRows] = useState<GoogleSheetRow[]>([]);
  const [availableMonths, setAvailableMonths] = useState<SheetMonthOption[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<SheetLoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const loadedMonthSigRef = useRef<string | null>(null);

  const monthKeySig = monthKeys ? [...monthKeys].sort().join(',') : '';
  // Computed at call time: once a sheet is known not to support month scoping,
  // reads and writes share the single legacy-window cache entry. `includeVideo`
  // is part of the key so a Detail dashboard's video-inclusive rows never get
  // served from (or clobbered by) a Summary/Simple/OverSpeed cache entry for
  // the same sheet/gid.
  const getCacheKey = useCallback(() => {
    const scoped = monthScoped && !monthScopeUnsupported.has(sheetKey(sheetId, gid));
    return `${CACHE_VERSION}:${sheetId}:${gid}:video=${includeVideo}:months=${scoped ? (monthKeySig || 'NONE') : 'recent'}`;
  }, [gid, includeVideo, monthKeySig, monthScoped, sheetId]);

  const readCache = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const cacheKey = getCacheKey();
    const isRealMonthFetch = monthScoped && monthKeySig && monthKeySig !== 'NONE';
    const cachedMemory = memoryCache.get(cacheKey);
    if (cachedMemory) {
      // Never treat an empty month payload as a hit — it is almost always a failed
      // fetch and it locks the UI at 0.
      if (cachedMemory.rows.length === 0 && isRealMonthFetch) {
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
      if (parsed.rows.length === 0 && isRealMonthFetch) {
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
  }, [getCacheKey, monthKeySig, monthScoped]);

  const writeCache = useCallback(
    (payload: CachedSheet) => {
      if (typeof window === 'undefined') return;
      // Do not persist empty month fetches — they poison the next load with zeros.
      if (payload.rows.length === 0 && monthScoped) return;
      const cacheKey = getCacheKey();
      memoryCache.set(cacheKey, payload);
      // Bound the in-memory cache: evict oldest entries (Map preserves insertion order)
      // so a long session across many months/dashboards can't grow it without limit.
      while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
        const oldest = memoryCache.keys().next().value;
        if (oldest === undefined) break;
        memoryCache.delete(oldest);
      }
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
    [getCacheKey, monthScoped],
  );

  const fetchMonthCatalog = useCallback(
    async (signal: AbortSignal): Promise<SheetMonthOption[]> => {
      const key = sheetKey(sheetId, gid);
      const hit = catalogCache.get(key);
      if (hit && Date.now() - hit.fetchedAt <= CATALOG_TTL_MS) return hit.months;

      // localStorage survives reloads — the catalogue is expensive (GViz group-by
      // scans the whole sheet) and rarely changes.
      const lsKey = `google-sheet-months:${key}`;
      try {
        const raw = window.localStorage.getItem(lsKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { months: SheetMonthOption[]; fetchedAt: number };
          if (parsed?.fetchedAt && Date.now() - parsed.fetchedAt <= CATALOG_TTL_MS) {
            catalogCache.set(key, { months: parsed.months, fetchedAt: parsed.fetchedAt });
            return parsed.months;
          }
        }
      } catch {
        // Ignore storage failures.
      }

      const res = await fetchWithTimeout(buildApiUrl(sheetId, gid, { mode: 'months' }), signal);
      if (!res.ok) throw new Error('Unable to list sheet months.');
      const data = (await res.json()) as { months?: SheetMonthOption[] };
      const months = Array.isArray(data.months) ? data.months : [];
      catalogCache.set(key, { months, fetchedAt: Date.now() });
      try {
        window.localStorage.setItem(lsKey, JSON.stringify({ months, fetchedAt: Date.now() }));
      } catch {
        // Ignore storage failures.
      }
      return months;
    },
    [gid, sheetId],
  );

  /** One chunk, straight from Google (fast path — no serverless hop, no payload cap). */
  const fetchDirectChunk = useCallback(
    async (
      meta: SheetMeta,
      from: string,
      to: string,
      signal: AbortSignal,
    ): Promise<CachedSheet> => {
      const url = buildGvizJsonUrl(sheetId, gid, {
        rowLimit: 50_000,
        where: buildDatedRowsWhere(meta.orderColId, from, to, 'A'),
        select: meta.select,
      });
      const res = await fetchWithTimeout(url, signal);
      if (!res.ok) throw new Error('Unable to fetch the Google Sheet data.');
      const parsed = parseGoogleSheetGvizText(await res.text());
      return { columns: parsed.columns, rows: parsed.rows, lastUpdated: Date.now() };
    },
    [gid, sheetId],
  );

  /** One chunk via the authenticated proxy (fallback when direct GViz is blocked). */
  const fetchProxyChunk = useCallback(
    async (
      from: string,
      to: string,
      signal: AbortSignal,
      includeVideo: boolean,
    ): Promise<CachedSheet> => {
      const query: Record<string, string> = includeVideo
        ? { from, to, video: '1' }
        : { from, to };
      const res = await fetchWithTimeout(buildApiUrl(sheetId, gid, query), signal);
      if (res.status === 422) throw new MonthScopeUnsupportedError();
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

  const runChunkJobs = useCallback(
    async (
      jobs: Array<{ start: string; endExclusive: string }>,
      runJob: (from: string, to: string) => Promise<CachedSheet>,
      signal: AbortSignal,
      onPartial: (acc: CachedSheet, done: number, total: number) => void,
    ): Promise<CachedSheet> => {
      let columnsAcc: GoogleSheetColumn[] = [];
      const rowsAcc: GoogleSheetRow[] = [];
      let done = 0;

      let next = 0;
      const worker = async () => {
        while (next < jobs.length) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const i = next++;
          const job = jobs[i]!;
          const part = await runJob(job.start, job.endExclusive);
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (columnsAcc.length === 0 && part.columns.length > 0) columnsAcc = part.columns;
          rowsAcc.push(...part.rows);
          done += 1;
          onPartial(
            { columns: columnsAcc, rows: rowsAcc, lastUpdated: Date.now() },
            done,
            jobs.length,
          );
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(FETCH_CONCURRENCY, Math.max(jobs.length, 1)) }, () =>
          worker(),
        ),
      );
      return { columns: columnsAcc, rows: rowsAcc, lastUpdated: Date.now() };
    },
    [],
  );

  const fetchMonths = useCallback(
    async (
      keys: string[],
      signal: AbortSignal,
      includeVideo: boolean,
      onPartial: (acc: CachedSheet, done: number, total: number) => void,
    ): Promise<CachedSheet> => {
      const buildJobs = (chunkDays: number) => {
        const jobs: Array<{ start: string; endExclusive: string }> = [];
        for (const key of keys) {
          const range = monthKeyToDateRange(key);
          if (!range) continue;
          jobs.push(...splitDateRangeIntoChunks(range.start, range.endExclusive, chunkDays));
        }
        return jobs;
      };

      const key = sheetKey(sheetId, gid);
      if (!directBroken.has(key)) {
        try {
          const meta = await getSheetMeta(sheetId, gid, signal, includeVideo);
          if (!meta.hasDateColumn) throw new MonthScopeUnsupportedError();
          return await runChunkJobs(
            buildJobs(DIRECT_CHUNK_DAYS),
            (from, to) => fetchDirectChunk(meta, from, to, signal),
            signal,
            onPartial,
          );
        } catch (err) {
          if (signal.aborted || isAbortError(err)) throw err;
          if (err instanceof MonthScopeUnsupportedError) throw err;
          // Direct GViz blocked or flaky for this sheet — remember and fall back.
          directBroken.add(key);
        }
      }

      return runChunkJobs(
        buildJobs(PROXY_CHUNK_DAYS),
        (from, to) => fetchProxyChunk(from, to, signal, includeVideo),
        signal,
        onPartial,
      );
    },
    [fetchDirectChunk, fetchProxyChunk, gid, runChunkJobs, sheetId],
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
      setProgress(null);
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
      setProgress(null);
      setError(null);
      return;
    }

    const switchingMonths =
      monthScoped &&
      loadedMonthSigRef.current !== null &&
      loadedMonthSigRef.current !== targetSig;

    // Drop stale rows immediately on month change so client-side month filters
    // don't zero out KPIs against the previous month's data.
    if (switchingMonths) {
      setRows([]);
      setColumns([]);
      setLoading(true);
      setRefreshing(false);
    } else if (loadedMonthSigRef.current === null) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }
    setProgress(null);
    setError(null);

    try {
      const key = sheetKey(sheetId, gid);
      let scopeBroken = monthScopeUnsupported.has(key);

      let months: SheetMonthOption[] = [];
      if (wantCatalog && !scopeBroken) {
        try {
          months = await fetchMonthCatalog(signal);
          if (gen !== fetchGen.current) return;
          setAvailableMonths(months);
          if (monthScoped && months.length === 0) {
            // No listable months (text dates, no date-typed column, or empty
            // sheet) — month scoping cannot work. Permanently fall back to the
            // legacy most-recent window instead of rendering a blank dashboard.
            monthScopeUnsupported.add(key);
            scopeBroken = true;
          }
        } catch (err) {
          if (signal.aborted || isAbortError(err)) return;
          // Catalogue unavailable this load — fall back to the legacy window
          // for now, but don't permanently mark the sheet.
          months = [];
          scopeBroken = monthScoped;
        }
      }

      if (monthScoped && !scopeBroken && (!monthKeys || monthKeys.length === 0)) {
        if (gen !== fetchGen.current) return;
        setRows([]);
        setColumns([]);
        setLastUpdated(new Date());
        if (loadedMonthSigRef.current === null) return;
        setRefreshing(false);
        setLoading(false);
        return;
      }

      let result: CachedSheet;
      if (monthScoped && !scopeBroken) {
        try {
          result = await fetchMonths(monthKeys!, signal, includeVideo, (acc, done, total) => {
            if (gen !== fetchGen.current) return;
            // Progressive apply: show data as soon as the first chunk lands.
            setColumns([...acc.columns]);
            setRows([...acc.rows]);
            setLastUpdated(new Date(acc.lastUpdated));
            setProgress({ done, total });
            if (acc.rows.length > 0) {
              setLoading(false);
              setRefreshing(done < total);
            }
          });
        } catch (err) {
          if (!(err instanceof MonthScopeUnsupportedError)) throw err;
          // Discovered mid-fetch (no date column / proxy 422): remember and
          // serve the legacy window instead of failing the dashboard.
          monthScopeUnsupported.add(key);
          result = await fetchRecent(signal);
        }
      } else {
        result = await fetchRecent(signal);
      }
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
        setProgress(null);
      }
    }
  }, [
    applyPayload,
    enabled,
    fetchMonthCatalog,
    fetchMonths,
    fetchRecent,
    gid,
    includeVideo,
    monthKeySig,
    monthKeys,
    monthScoped,
    readCache,
    sheetId,
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
    progress,
    error,
    lastUpdated,
    refresh: fetchSheet,
    availableMonths,
  };
}
