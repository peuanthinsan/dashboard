'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type SheetColumn = {
  label: string;
  field: string;
  type: 'string' | 'number' | 'date' | 'datetime';
};

export type SheetRow = Record<string, string | number | Date | null>;
export type FormattedRow = Record<string, string>;

const DATE_HEADER_HINTS = ['date', 'time', 'timestamp'];

const normalizeHeader = (header: string) => header.trim().toLowerCase();

const isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value.trim());

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let current: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      current.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (value.length > 0 || current.length > 0) {
        current.push(value);
        rows.push(current);
        current = [];
        value = '';
      }
      continue;
    }

    value += char;
  }

  if (value.length > 0 || current.length > 0) {
    current.push(value);
    rows.push(current);
  }

  return rows;
};

const detectColumnType = (label: string, sample: string | undefined) => {
  const normalized = normalizeHeader(label);
  const hint = DATE_HEADER_HINTS.some((keyword) => normalized.includes(keyword));
  if (hint) {
    return normalized.includes('time') ? 'datetime' : 'date';
  }
  if (sample && isNumeric(sample)) {
    return 'number';
  }
  return 'string';
};

const parseCellValue = (raw: string, type: SheetColumn['type']) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (type === 'number') {
    const value = Number(trimmed);
    return Number.isNaN(value) ? trimmed : value;
  }
  if (type === 'date' || type === 'datetime') {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed;
  }
  return trimmed;
};

const formatCellValue = (value: string | number | Date | null) => {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  return String(value);
};

export default function useGoogleSheet({ sheetId, gid }: { sheetId: string; gid: string }) {
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [records, setRecords] = useState<SheetRow[]>([]);
  const [formattedRows, setFormattedRows] = useState<FormattedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const sheetUrl = useMemo(
    () => `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    [gid, sheetId],
  );

  const fetchSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(sheetUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to load sheet (${response.status})`);
      }
      const text = await response.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setColumns([]);
        setRecords([]);
        setFormattedRows([]);
        setLoading(false);
        return;
      }

      const headerRow = rows[0];
      const sampleRow = rows[1] ?? [];
      const nextColumns = headerRow.map((header, index) => ({
        label: header.trim(),
        field: `col_${index}`,
        type: detectColumnType(header, sampleRow[index]),
      }));

      const nextRecords = rows.slice(1).map((row) => {
        const record: SheetRow = {};
        nextColumns.forEach((column, index) => {
          record[column.field] = parseCellValue(row[index] ?? '', column.type);
        });
        return record;
      });

      const nextFormatted = nextRecords.map((record) => {
        const formatted: FormattedRow = {};
        nextColumns.forEach((column) => {
          formatted[column.field] = formatCellValue(record[column.field]);
        });
        return formatted;
      });

      setColumns(nextColumns);
      setRecords(nextRecords);
      setFormattedRows(nextFormatted);
      setLastUpdated(new Date());
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load sheet.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sheetUrl]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  return { columns, records, formattedRows, loading, error, lastUpdated, refresh: fetchSheet };
}
