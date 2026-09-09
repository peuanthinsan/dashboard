'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseGoogleSheetTable, type GoogleSheetColumn, type GoogleSheetRow } from './googleSheetParse';

type Options = { sheetId: string; gid?: string; tabName?: string; enabled?: boolean };
type Snapshot = { columns: GoogleSheetColumn[]; rows: GoogleSheetRow[]; lastUpdated: Date | null };

/** Small live status sheets: fresh reads on every refresh, with no alert-data cache. */
export default function useUnitStatusSheet({ sheetId, gid, tabName, enabled = true }: Options) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ columns: [], rows: [], lastUpdated: null });
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const hasSnapshot = useRef(false);
  const refresh = useCallback(async () => {
    request.current?.abort();
    if (!enabled) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(!hasSnapshot.current);
    setRefreshing(hasSnapshot.current);
    setError(null);
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const params = new URLSearchParams({ tqx: 'out:json', headers: '1' });
      if (tabName) params.set('sheet', tabName);
      else params.set('gid', gid ?? '0');
      const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`, {
        signal: controller.signal, cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Unable to load ${tabName ?? 'unit status'} data.`);
      const payload = await response.text();
      // The common parser accepts table-less GViz errors as empty data. Fail visibly.
      const match = payload.match(/setResponse\(([\s\S]*)\);/);
      const envelope = match ? JSON.parse(match[1]) as Parameters<typeof parseGoogleSheetTable>[0] & { status?: string } : null;
      if (!envelope?.table || envelope.status === 'error') throw new Error(`Unable to read ${tabName ?? 'unit status'} data.`);
      const parsed = parseGoogleSheetTable(envelope);
      if (request.current !== controller || controller.signal.aborted) return;
      hasSnapshot.current = true;
      setSnapshot({ ...parsed, lastUpdated: new Date() });
    } catch (err) {
      if (request.current !== controller) return;
      setError(controller.signal.aborted ? 'Loading timed out. Please retry.'
        : err instanceof Error ? err.message : 'Unable to load unit status data.');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled, gid, sheetId, tabName]);

  useEffect(() => {
    hasSnapshot.current = false;
    setSnapshot({ columns: [], rows: [], lastUpdated: null });
    if (!enabled) { setLoading(false); setRefreshing(false); setError(null); }
    void refresh();
    return () => {
      const pending = request.current;
      request.current = null;
      pending?.abort();
    };
  }, [enabled, refresh]);

  return { ...snapshot, loading, refreshing, error, refresh };
}
