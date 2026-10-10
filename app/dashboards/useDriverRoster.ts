'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DriverRosterEntry, DriverRosterSettings } from './driverRoster';

type RosterResult = { entries: DriverRosterEntry[]; namePolicy: DriverRosterSettings['namePolicy']; lastUpdated: number };
type State = { key: string; attempt: number; result?: RosterResult; error?: string };
const EMPTY_ROSTER: DriverRosterEntry[] = [];
export default function useDriverRoster(dashboardId: string, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const key = enabled ? dashboardId : '';
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/driver-roster/${encodeURIComponent(key)}`, { cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40_000)]) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load the driver roster.');
        if (!controller.signal.aborted) setState({ key, attempt, result: body });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key, attempt, error: error instanceof Error ? error.message : 'Unable to load the driver roster.' });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, attempt]);
  const current = state?.key === key && state.attempt === attempt ? state : null;
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  return { entries: current?.result?.entries ?? EMPTY_ROSTER, namePolicy: current?.result?.namePolicy ?? 'recorded',
    loading: enabled && !current, error: current?.error, lastUpdated: current?.result?.lastUpdated, refresh };
}
