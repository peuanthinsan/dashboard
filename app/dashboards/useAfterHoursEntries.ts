'use client';

import { useEffect, useState } from 'react';
import { isEntryRange, type AfterHoursEntry, type AfterHoursSettings, type EntryDateRange } from './afterHoursEntry';

type LoadState = {
  key: string; status: 'loading' | 'ready' | 'error'; entries: AfterHoursEntry[];
  settings: AfterHoursSettings | null; invalidDates: number; scanned: number; updated: number | null; error: string | null;
};
const empty = { entries: [], settings: null, invalidDates: 0, scanned: 0, updated: null, error: null };

export function useAfterHoursEntries(dashboardId: string, range: EntryDateRange, refresh: number, dataUrl?: string) {
  const { from, to } = range;
  const endpoint = dataUrl ?? `/api/after-hours/${encodeURIComponent(dashboardId)}`;
  const key = `${endpoint}:${from}:${to}:${refresh}`;
  const [state, setState] = useState<LoadState>({ ...empty, key: '', status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      // Keep effect cleanup able to cancel even the first state transition.
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setState({ ...empty, key, status: 'loading' });
      try {
        if (!isEntryRange({ from, to })) throw new Error('Select a valid start and end date.');
        const entries: AfterHoursEntry[] = [];
        let offset = 0, scanned = 0, invalidDates = 0;
        let savedSettings: string | null = null;
        while (!controller.signal.aborted) {
          const query = new URLSearchParams({ from, to, offset: String(offset) });
          const response = await fetch(`${endpoint}?${query}`, {
            signal: controller.signal, cache: 'no-store',
          });
          const page = await response.json();
          if (!response.ok) throw new Error(page.error ?? 'Unable to load after-hours entries.');
          if (!Array.isArray(page.entries) || typeof page.hasMore !== 'boolean' || !page.settings
            || !Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset) throw new Error('Incomplete sheet response. Please refresh.');
          const signature = page.configurationKey ?? JSON.stringify(page.settings);
          if (savedSettings && savedSettings !== signature) throw new Error('Admin changed the dashboard settings while loading. Please refresh.');
          savedSettings = signature;
          entries.push(...page.entries);
          scanned += page.scanned;
          invalidDates += page.invalidDates;
          if (controller.signal.aborted) return;
          if (!page.hasMore) {
            entries.sort((a, b) => b.timestamp - a.timestamp);
            setState({ key, status: 'ready', entries, settings: page.settings, invalidDates, scanned, updated: page.lastUpdated, error: null });
            return;
          }
          setState({ ...empty, key, status: 'loading', scanned });
          offset = page.nextOffset;
        }
      } catch (error) {
        if (!controller.signal.aborted) setState({ ...empty, key, status: 'error', error: error instanceof Error ? error.message : 'Unable to load entries.' });
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, from, to, key]);
  // Never render totals from an earlier period while the next effect starts.
  return state.key === key ? state : { ...empty, key, status: 'loading' as const };
}
