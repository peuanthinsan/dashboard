'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type GoogleSheetColumnType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

export type GoogleSheetColumn = {
  field: string;
  label: string;
  type: GoogleSheetColumnType;
};

export type GoogleSheetRecord = Record<string, string | number | boolean | Date | null>;

export type GoogleSheetFormattedRow = Record<string, string>;

type GoogleSheetResult = {
  columns: GoogleSheetColumn[];
  records: GoogleSheetRecord[];
  formattedRows: GoogleSheetFormattedRow[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
};

type UseGoogleSheetArgs = {
  sheetId: string;
  gid: string;
};

const GOOGLE_DATE_PATTERN = /^Date\\((\\d+),(\\d+),(\\d+)(?:,(\\d+),(\\d+),(\\d+))?\\)$/;

const parseGoogleDate = (value: string) => {
  const match = GOOGLE_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const parsed = new Date(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const normalizeColumnLabel = (label: string, index: number) => {
  const trimmed = label.trim();
  if (trimmed) {
    return trimmed;
  }
  return `Column ${index + 1}`;
};

const buildFieldKey = (label: string, index: number) => {
  const trimmed = label.trim();
  if (!trimmed) {
    return `column_${index + 1}`;
  }
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
};

export default function useGoogleSheet({ sheetId, gid }: UseGoogleSheetArgs): GoogleSheetResult {
  const [columns, setColumns] = useState<GoogleSheetColumn[]>([]);
  const [records, setRecords] = useState<GoogleSheetRecord[]>([]);
  const [formattedRows, setFormattedRows] = useState<GoogleSheetFormattedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  const url = useMemo(
    () => `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`,
    [gid, sheetId],
  );

  useEffect(() => {
    let isActive = true;
    const fetchSheet = async () => {
      if (!sheetId) {
        if (isActive) {
          setLoading(false);
          setError('Missing Google Sheet ID.');
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to load Google Sheet data.');
        }
        const text = await response.text();
        const match = text.match(/setResponse\\((.*)\\);/s);
        if (!match) {
          throw new Error('Unexpected Google Sheet response.');
        }
        const parsed = JSON.parse(match[1]);
        const table = parsed.table;
        const nextColumns: GoogleSheetColumn[] = table.cols.map(
          (column: { label: string; type: GoogleSheetColumnType }, index: number) => ({
            label: normalizeColumnLabel(column.label ?? '', index),
            field: buildFieldKey(column.label ?? '', index),
            type: column.type ?? 'string',
          }),
        );
        const nextRecords: GoogleSheetRecord[] = [];
        const nextFormatted: GoogleSheetFormattedRow[] = [];

        table.rows.forEach((row: { c: Array<{ v: string | number | boolean | null; f?: string } | null> }) => {
          const record: GoogleSheetRecord = {};
          const formatted: GoogleSheetFormattedRow = {};
          nextColumns.forEach((column, index) => {
            const cell = row.c[index];
            let value: GoogleSheetRecord[string] = cell?.v ?? null;
            if (typeof value === 'string' && value.startsWith('Date(')) {
              const parsedDate = parseGoogleDate(value);
              if (parsedDate) {
                value = parsedDate;
              }
            }
            record[column.field] = value;
            if (cell?.f) {
              formatted[column.field] = cell.f;
            } else if (value instanceof Date) {
              formatted[column.field] = value.toLocaleString();
            } else if (value != null) {
              formatted[column.field] = String(value);
            } else {
              formatted[column.field] = '';
            }
          });
          nextRecords.push(record);
          nextFormatted.push(formatted);
        });

        if (isActive) {
          setColumns(nextColumns);
          setRecords(nextRecords);
          setFormattedRows(nextFormatted);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (isActive) {
          const message = err instanceof Error ? err.message : 'Unexpected error loading sheet data.';
          setError(message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };
    fetchSheet();
    return () => {
      isActive = false;
    };
  }, [refreshIndex, url]);

  return { columns, records, formattedRows, loading, error, lastUpdated, refresh };
}
