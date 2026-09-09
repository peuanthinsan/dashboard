'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  scopedLocationVehicles, type LocationVehicleCatalog, type LocationVehiclePage,
} from './locationVehicleData';

type Snapshot = LocationVehiclePage & { key: string; nextOffset: number };
type Status = { key: string; pending: boolean; error: string | null };
const EMPTY_ROWS: LocationVehiclePage['rows'] = [];
const EMPTY_COLUMNS: LocationVehiclePage['columns'] = [];

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(55_000)]), cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to load vehicle data.');
  return body as T;
}

export default function useLocationVehicleData({
  sheetId, gid, preferredVehicle, scopes, enabled,
}: {
  sheetId: string; gid: string; preferredVehicle: string | null; scopes: string[]; enabled: boolean;
}) {
  const base = `/api/sheets/${encodeURIComponent(sheetId)}/${encodeURIComponent(gid)}`;
  const [generation, setGeneration] = useState(0);
  const catalogKey = `${base}:${generation}`;
  const [catalogState, setCatalogState] = useState<{ key: string; data?: LocationVehicleCatalog; error?: string } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  // Only recently visited vehicles are cached. No background fleet prefetch or full-sheet cache.
  const cache = useRef(new Map<string, Snapshot>());
  const moreController = useRef<AbortController | null>(null);
  const scopeKey = JSON.stringify(scopes);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getJson<LocationVehicleCatalog>(`${base}?mode=location-vehicles${generation ? '&refresh=1' : ''}`, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setCatalogState({ key: catalogKey, data }); })
      .catch((error: Error) => { if (!controller.signal.aborted) setCatalogState({ key: catalogKey, error: error.message }); });
    return () => controller.abort();
  }, [base, catalogKey, enabled, generation]);

  const catalog = catalogState?.key === catalogKey ? catalogState : null;
  const selection = useMemo(() => {
    if (!catalog?.data) return { options: [], error: catalog?.error ?? null };
    try {
      return { options: scopedLocationVehicles(catalog.data, JSON.parse(scopeKey)), error: null };
    } catch (error) {
      return { options: [], error: (error as Error).message };
    }
  }, [catalog, scopeKey]);
  const selectedVehicle = selection.options.find((vehicle) => vehicle === preferredVehicle) ?? selection.options[0] ?? null;
  const rowKey = JSON.stringify([base, scopeKey, selectedVehicle, generation]);

  const remember = useCallback((data: Snapshot) => {
    cache.current.delete(data.key);
    cache.current.set(data.key, data);
    while (cache.current.size > 3) cache.current.delete(cache.current.keys().next().value!);
    setSnapshot(data);
  }, []);

  useEffect(() => {
    if (!enabled || !selectedVehicle) return;
    const controller = new AbortController();
    const vehicle = selectedVehicle;
    const cached = cache.current.get(rowKey);
    async function load() {
      if (cached && Date.now() - cached.lastUpdated < 5 * 60_000) {
        setSnapshot(cached);
        setStatus({ key: rowKey, pending: false, error: null });
        return;
      }
      setStatus({ key: rowKey, pending: true, error: null });
      try {
        const data = await getJson<LocationVehiclePage>(`${base}?${new URLSearchParams({ mode: 'location-rows', vehicle, scopes: scopeKey })}`, controller.signal);
        if (!controller.signal.aborted) remember({ ...data, key: rowKey, nextOffset: data.rows.length });
        if (!controller.signal.aborted) setStatus({ key: rowKey, pending: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setStatus({ key: rowKey, pending: false, error: (error as Error).message });
      }
    }
    void load();
    return () => { controller.abort(); moreController.current?.abort(); moreController.current = null; };
  }, [base, enabled, remember, rowKey, scopeKey, selectedVehicle]);

  // Hide the previous vehicle synchronously, before the next request effect runs.
  const visible = selectedVehicle && snapshot?.key === rowKey ? snapshot : null;
  const currentStatus = status?.key === rowKey ? status : null;

  const loadMore = useCallback(async () => {
    if (!visible?.hasMore || moreController.current || currentStatus?.pending) return;
    const controller = new AbortController();
    moreController.current = controller;
    setStatus({ key: rowKey, pending: true, error: null });
    try {
      const data = await getJson<LocationVehiclePage>(`${base}?${new URLSearchParams({
        mode: 'location-rows', vehicle: visible.vehicle, offset: String(visible.nextOffset), scopes: scopeKey,
      })}`, controller.signal);
      if (!controller.signal.aborted) {
        remember({ ...data, rows: [...visible.rows, ...data.rows], key: rowKey, nextOffset: data.offset + data.rows.length });
        setStatus({ key: rowKey, pending: false, error: null });
      }
    } catch (error) {
      if (!controller.signal.aborted) setStatus({ key: rowKey, pending: false, error: (error as Error).message });
    } finally {
      if (moreController.current === controller) moreController.current = null;
    }
  }, [base, currentStatus?.pending, remember, rowKey, scopeKey, visible]);

  const refresh = useCallback(() => {
    moreController.current?.abort();
    cache.current.clear();
    setGeneration((value) => value + 1);
  }, []);

  return {
    selectedVehicle, vehicleOptions: selection.options,
    columns: visible?.columns ?? EMPTY_COLUMNS, rows: visible?.rows ?? EMPTY_ROWS,
    loading: !enabled || !catalog || Boolean(selectedVehicle && !visible && !currentStatus?.error),
    refreshing: Boolean(currentStatus?.pending),
    error: selection.error ?? currentStatus?.error ?? null,
    lastUpdated: visible ? new Date(visible.lastUpdated) : null,
    hasMore: visible?.hasMore ?? false, loadMore, refresh,
  };
}
