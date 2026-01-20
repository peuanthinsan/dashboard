'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type SheetColumn = {
  label: string;
  type: string;
  field: string;
};

type SheetResponse = {
  columns: SheetColumn[];
  records: Record<string, unknown>[];
  formattedRows: Record<string, string | null>[];
};

type UseGoogleSheetOptions = {
  sheetId: string;
  gid: string;
};

export default function useGoogleSheet({ sheetId, gid }: UseGoogleSheetOptions) {
  const [data, setData] = useState<SheetResponse>({
    columns: [],
    records: [],
    formattedRows: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/google-sheet?sheetId=${sheetId}&gid=${gid}`,
          { cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error('Unable to fetch Google Sheet data.');
        }
        const json = (await response.json()) as SheetResponse;
        if (!isActive) return;
        setData({
          columns: json.columns ?? [],
          records: json.records ?? [],
          formattedRows: json.formattedRows ?? [],
        });
        setLastUpdated(new Date());
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : 'Unable to load sheet data.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [gid, refreshKey, sheetId]);

  return useMemo(
    () => ({
      ...data,
      loading,
      error,
      lastUpdated,
      refresh,
    }),
    [data, loading, error, lastUpdated, refresh],
  );
}
