import { useCallback, useEffect, useMemo, useState } from 'react';

const parseCsv = (text) => {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
};

const inferColumnType = (value) => {
  const trimmed = value?.trim?.() ?? '';
  if (!trimmed) {
    return 'text';
  }
  const numeric = Number(trimmed.replace(/,/g, ''));
  if (!Number.isNaN(numeric) && trimmed.match(/^-?[\d,.]+$/)) {
    return 'number';
  }
  const parsedDate = new Date(trimmed);
  if (!Number.isNaN(parsedDate.getTime())) {
    if (trimmed.match(/:\d{2}/) || trimmed.match(/[AP]M/i)) {
      return 'datetime';
    }
    return 'date';
  }
  return 'text';
};

const normalizeHeader = (label, index) => {
  const trimmed = label?.trim();
  return trimmed ? trimmed : `Column ${index + 1}`;
};

export default function useGoogleSheet({ sheetId, gid }) {
  const [columns, setColumns] = useState([]);
  const [records, setRecords] = useState([]);
  const [formattedRows, setFormattedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const sheetUrl = useMemo(() => {
    if (!sheetId) return null;
    const resolvedGid = gid || '0';
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${resolvedGid}`;
  }, [gid, sheetId]);

  const fetchSheet = useCallback(async () => {
    if (!sheetUrl) {
      setColumns([]);
      setRecords([]);
      setFormattedRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error('Unable to load sheet data.');
      }
      const csvText = await response.text();
      const rows = parseCsv(csvText).filter((row) => row.some((cell) => cell?.trim?.()));
      if (rows.length === 0) {
        setColumns([]);
        setRecords([]);
        setFormattedRows([]);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      const headerRow = rows[0];
      const dataRows = rows.slice(1);
      const resolvedColumns = headerRow.map((label, index) => ({
        label: normalizeHeader(label, index),
        field: `col_${index}`,
      }));

      const columnTypes = headerRow.map((_, columnIndex) => {
        for (const row of dataRows) {
          const value = row[columnIndex];
          if (value && value.trim()) {
            return inferColumnType(value);
          }
        }
        return 'text';
      });

      const nextRecords = dataRows.map((row) => {
        const entry = {};
        resolvedColumns.forEach((column, columnIndex) => {
          const rawValue = row[columnIndex] ?? '';
          const trimmed = rawValue.trim?.() ?? rawValue;
          const type = columnTypes[columnIndex];
          if (type === 'number') {
            const numeric = Number(String(trimmed).replace(/,/g, ''));
            entry[column.field] = Number.isNaN(numeric) ? trimmed : numeric;
          } else if (type === 'date' || type === 'datetime') {
            const parsed = new Date(trimmed);
            entry[column.field] = Number.isNaN(parsed.getTime()) ? trimmed : parsed;
          } else {
            entry[column.field] = trimmed;
          }
        });
        return entry;
      });

      const nextFormattedRows = nextRecords.map((row) => {
        const formatted = {};
        resolvedColumns.forEach((column, columnIndex) => {
          const value = row[column.field];
          const type = columnTypes[columnIndex];
          if (value instanceof Date && !Number.isNaN(value.getTime())) {
            formatted[column.field] =
              type === 'date' ? value.toLocaleDateString() : value.toLocaleString();
          } else {
            formatted[column.field] = value ?? '';
          }
        });
        return formatted;
      });

      setColumns(
        resolvedColumns.map((column, index) => ({
          ...column,
          type: columnTypes[index],
        })),
      );
      setRecords(nextRecords);
      setFormattedRows(nextFormattedRows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sheet data.');
    } finally {
      setLoading(false);
    }
  }, [sheetUrl]);

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
