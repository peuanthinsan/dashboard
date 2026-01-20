'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseSheetUrl } from '../../utils/googleSheet';

export type SheetColumnType = 'string' | 'number' | 'date' | 'datetime';

export type SheetColumn = {
  label: string;
  field: string;
  type: SheetColumnType;
};

export type SheetRecordValue = string | number | Date | null;
export type SheetRecord = Record<string, SheetRecordValue>;

type FormattedRow = Record<string, string>;

type SheetResponse = {
  columns: SheetColumn[];
  records: SheetRecord[];
  formattedRows: FormattedRow[];
};

const CSV_SEPARATOR = ',';

const normalizeHeader = (header: string, index: number, existing: Set<string>) => {
  const base = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const initial = base || `column_${index + 1}`;
  let candidate = initial;
  let counter = 1;
  while (existing.has(candidate)) {
    candidate = `${initial}_${counter}`;
    counter += 1;
  }
  existing.add(candidate);
  return candidate;
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === CSV_SEPARATOR && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if (char === '\n' && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }
    if (char === '\r' && !inQuotes) {
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
};

const inferColumnType = (values: string[]): SheetColumnType => {
  const filtered = values.map((value) => value.trim()).filter(Boolean);
  if (filtered.length === 0) {
    return 'string';
  }
  const isNumeric = filtered.every((value) => !Number.isNaN(Number(value)));
  if (isNumeric) {
    return 'number';
  }
  const hasDate = filtered.every((value) => !Number.isNaN(Date.parse(value)));
  if (hasDate) {
    const hasTime = filtered.some((value) => /\d{1,2}:\d{2}/.test(value));
    return hasTime ? 'datetime' : 'date';
  }
  return 'string';
};

const parseValue = (value: string, type: SheetColumnType): SheetRecordValue => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  switch (type) {
    case 'number': {
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? trimmed : parsed;
    }
    case 'date':
    case 'datetime': {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? trimmed : parsed;
    }
    default:
      return trimmed;
  }
};

const formatValue = (value: SheetRecordValue) => {
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const buildCsvUrl = (sheetUrl: string) => {
  if (!sheetUrl) return null;
  if (sheetUrl.includes('export?format=csv')) {
    return sheetUrl;
  }
  const reference = parseSheetUrl(sheetUrl);
  if (!reference) {
    return sheetUrl;
  }
  return `https://docs.google.com/spreadsheets/d/${reference.id}/export?format=csv&gid=${reference.gid}`;
};

const parseSheetData = (csvText: string): SheetResponse => {
  const rows = parseCsv(csvText);
  const headerRow = rows[0] ?? [];
  const headerKeys = new Set<string>();
  const fields = headerRow.map((header, index) => normalizeHeader(header, index, headerKeys));
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell?.trim()));
  const columnValues = fields.map(() => [] as string[]);
  dataRows.forEach((row) => {
    fields.forEach((_, index) => {
      columnValues[index].push(row[index] ?? '');
    });
  });
  const columns: SheetColumn[] = fields.map((field, index) => ({
    field,
    label: headerRow[index] || `Column ${index + 1}`,
    type: inferColumnType(columnValues[index]),
  }));
  const records: SheetRecord[] = dataRows.map((row) => {
    const record: SheetRecord = {};
    columns.forEach((column, index) => {
      record[column.field] = parseValue(row[index] ?? '', column.type);
    });
    return record;
  });
  const formattedRows = records.map((record) => {
    const formatted: FormattedRow = {};
    columns.forEach((column) => {
      formatted[column.field] = formatValue(record[column.field]);
    });
    return formatted;
  });
  return { columns, records, formattedRows };
};

export default function useGoogleSheet({ sheetUrl }: { sheetUrl: string }) {
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [records, setRecords] = useState<SheetRecord[]>([]);
  const [formattedRows, setFormattedRows] = useState<FormattedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const csvUrl = useMemo(() => buildCsvUrl(sheetUrl), [sheetUrl]);

  const fetchSheet = useCallback(async () => {
    if (!csvUrl) {
      setError('Missing Google Sheets link.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Unable to load sheet (${response.status})`);
      }
      const text = await response.text();
      const parsed = parseSheetData(text);
      setColumns(parsed.columns);
      setRecords(parsed.records);
      setFormattedRows(parsed.formattedRows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sheet data.');
    } finally {
      setLoading(false);
    }
  }, [csvUrl]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  return {
    columns,
    records,
    formattedRows,
    loading,
    error,
    lastUpdated,
    refresh: fetchSheet,
  };
}
