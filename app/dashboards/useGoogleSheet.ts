'use client';

import { useCallback, useEffect, useState } from 'react';

type SheetColumn = {
  label: string;
  type: string;
};

type UseGoogleSheetOptions = {
  sheetId: string;
  gid: string;
};

type SheetRow = Record<string, string | number | boolean | null>;

type SheetResponse = {
  columns: SheetColumn[];
  rows: SheetRow[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
};

const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

const parseGoogleSheet = (payload: string) => {
  const match = payload.match(/setResponse\((.*)\);/s);
  if (!match) {
    throw new Error('Unable to read the Google Sheet response.');
  }
  const json = JSON.parse(match[1]);
  const columns = (json.table?.cols ?? []).map((col: { label?: string; type?: string }, index: number) => ({
    label: col?.label ? String(col.label).trim() : `Column ${index + 1}`,
    type: col?.type ?? 'string',
  }));
  const rows = (json.table?.rows ?? []).map((row: { c?: Array<{ f?: any; v?: any } | null> }) => {
    const record: SheetRow = {};
    (row?.c ?? []).forEach((cell, index) => {
      const column = columns[index];
      if (!column) return;
      record[column.label] = cell?.f ?? cell?.v ?? null;
    });
    return record;
  });
  return { columns, rows };
};

export default function useGoogleSheet({ sheetId, gid }: UseGoogleSheetOptions): SheetResponse {
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildSheetUrl(sheetId, gid));
      if (!response.ok) {
        throw new Error('Unable to fetch the Google Sheet data.');
      }
      const text = await response.text();
      const parsed = parseGoogleSheet(text);
      setColumns(parsed.columns);
      setRows(parsed.rows);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch the Google Sheet data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [gid, sheetId]);

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
