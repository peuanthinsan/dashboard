'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type GoogleSheetColumn,
  type GoogleSheetRow,
  parseGoogleSheetGvizText,
} from './googleSheetParse';

type SheetColumn = GoogleSheetColumn;

type UseGoogleSheetOptions = {
  sheetId: string;
  gid: string;
};

type SheetRow = GoogleSheetRow;

type SheetResponse = {
  columns: SheetColumn[];
  rows: SheetRow[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
};

type CachedSheet = {
  columns: SheetColumn[];
  rows: SheetRow[];
  lastUpdated: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_CHARS = 2_000_000;
const memoryCache = new Map<string, CachedSheet>();

const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

const buildApiUrl = (sheetId: string, gid: string) =>
  `/api/sheets/${encodeURIComponent(sheetId)}/${encodeURIComponent(gid)}`;

export default function useGoogleSheet({ sheetId, gid }: UseGoogleSheetOptions): SheetResponse {
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const cacheKey = `google-sheet:v2:${sheetId}:${gid}`;

  const readCache = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const cachedMemory = memoryCache.get(cacheKey);
    if (cachedMemory) {
      if (Date.now() - cachedMemory.lastUpdated <= CACHE_TTL_MS) {
        return cachedMemory;
      }
      memoryCache.delete(cacheKey);
    }
    let cached: string | null = null;
    try {
      cached = window.localStorage.getItem(cacheKey);
    } catch {
      return null;
    }
    if (!cached) {
      return null;
    }
    try {
      const parsed = JSON.parse(cached) as CachedSheet;
      if (!parsed?.lastUpdated || Date.now() - parsed.lastUpdated > CACHE_TTL_MS) {
        memoryCache.delete(cacheKey);
        window.localStorage.removeItem(cacheKey);
        return null;
      }
      memoryCache.set(cacheKey, parsed);
      return parsed;
    } catch {
      memoryCache.delete(cacheKey);
      window.localStorage.removeItem(cacheKey);
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    (payload: CachedSheet) => {
      if (typeof window === 'undefined') {
        return;
      }
      memoryCache.set(cacheKey, payload);
      const serialized = JSON.stringify(payload);
      if (serialized.length > MAX_CACHE_CHARS) {
        return;
      }
      try {
        window.localStorage.setItem(cacheKey, serialized);
      } catch {
        try {
          window.localStorage.removeItem(cacheKey);
        } catch {
          // Ignore storage failures.
        }
      }
    },
    [cacheKey],
  );

  const fetchSheet = useCallback(async () => {
    const cached = readCache();
    if (cached) {
      setColumns(cached.columns);
      setRows(cached.rows);
      setLastUpdated(new Date(cached.lastUpdated));
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const tryFetch = async (url: string, isJson: boolean): Promise<CachedSheet | null> => {
      const response = await fetch(url);
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
      let result: CachedSheet | null = null;
      try {
        result = await tryFetch(buildApiUrl(sheetId, gid), true);
      } catch {
        result = await tryFetch(buildSheetUrl(sheetId, gid), false);
      }
      if (result) {
        setColumns(result.columns);
        setRows(result.rows);
        setLastUpdated(new Date(result.lastUpdated));
        writeCache(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch the Google Sheet data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [gid, readCache, sheetId, writeCache]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  return {
    columns,
    rows,
    loading,
    error,
    lastUpdated,
    refresh: fetchSheet,
  };
}
