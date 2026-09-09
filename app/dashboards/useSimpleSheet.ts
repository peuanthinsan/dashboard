'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadSimpleSheet, type SimpleSheetResult } from './simpleSheetFetch';

/** The caller keys this hook's component by source, isolating in-flight loads. */
export default function useSimpleSheet(sheetId: string, gid: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SimpleSheetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadSimpleSheet(sheetId, gid, controller.signal).then(
      (next) => { if (!controller.signal.aborted) setResult(next); },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the monthly summary. Please retry.');
      },
    );
    return () => controller.abort();
  }, [sheetId, gid, attempt]);
  const refresh = useCallback(() => {
    setResult(null);
    setError(null);
    setAttempt((current) => current + 1);
  }, []);
  return { result, error, refresh };
}
