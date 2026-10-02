'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadFuelSheet } from './fuelSheet';
import type { GoogleSheetColumn, GoogleSheetRow } from './googleSheetParse';

type Snapshot = { columns: GoogleSheetColumn[]; rows: GoogleSheetRow[]; lastUpdated: Date | null };
const empty = (): Snapshot => ({ columns: [], rows: [], lastUpdated: null });

export default function useFuelSheet(sheetId: string, gid: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const data = await loadFuelSheet(sheetId, gid, controller.signal);
      if (request.current !== controller || controller.signal.aborted) return;
      setSnapshot({ ...data, lastUpdated: new Date() });
    } catch (err) {
      if (request.current !== controller) return;
      setError(controller.signal.aborted ? 'Loading timed out. Please retry.' : err instanceof Error ? err.message : 'Unable to load fuel data.');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) setLoading(false);
    }
  }, [sheetId, gid]);

  useEffect(() => {
    setSnapshot(empty());
    void refresh();
    return () => {
      const pending = request.current;
      request.current = null;
      pending?.abort();
    };
  }, [refresh]);
  return { ...snapshot, loading, error, refresh };
}
