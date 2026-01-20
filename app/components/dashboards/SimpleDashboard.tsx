'use client';

import { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import useGoogleSheet from 'app/hooks/useGoogleSheet';
import { parseSheetUrl } from 'app/utils/googleSheet';

type SimpleDashboardProps = {
  title: string;
  sheetUrl: string;
};

const normalizeLabel = (label: string) => label.trim().toLowerCase();

const buildColumnFinder =
  (columns: { label: string; field: string }[]) =>
  ({ matches, fallbackIndex }: { matches: string[]; fallbackIndex: number | null }) => {
    const match = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return matches.some((target) => label === target || label.includes(target));
    });
    if (match) return match;
    if (fallbackIndex == null) return null;
    return columns[fallbackIndex] || null;
  };

const formatDateLabel = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString();
};

export default function SimpleDashboard({ title, sheetUrl }: SimpleDashboardProps) {
  const reference = useMemo(() => parseSheetUrl(sheetUrl), [sheetUrl]);

  const { columns, records, formattedRows, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId: reference?.sheetId ?? '',
    gid: reference?.gid ?? '0',
  });

  const findColumn = useMemo(() => buildColumnFinder(columns), [columns]);

  const vehicleColumn = useMemo(
    () =>
      findColumn({
        matches: ['vehicle no', 'vehicle number', 'vehicle'],
        fallbackIndex: 0,
      }),
    [findColumn],
  );
  const alertTypeColumn = useMemo(
    () =>
      findColumn({
        matches: ['alert type', 'alert'],
        fallbackIndex: 2,
      }),
    [findColumn],
  );
  const dateTimeColumn = useMemo(() => {
    const preferred = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return label.includes('alert date time') || label.includes('track time');
    });
    if (preferred) return preferred;
    const fallback = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return column.type === 'date' || column.type === 'datetime' || label.includes('date');
    });
    return fallback || null;
  }, [columns]);
  const remarkColumn = useMemo(
    () =>
      findColumn({
        matches: ['remarks', 'remark'],
        fallbackIndex: null,
      }),
    [findColumn],
  );

  const alerts = useMemo(() => {
    if (!vehicleColumn || !alertTypeColumn || !dateTimeColumn) return [];
    return records
      .map((row, index) => {
        const dateValue = row[dateTimeColumn.field];
        if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
          return null;
        }
        const vehicle = row[vehicleColumn.field];
        const alertType = row[alertTypeColumn.field];
        if (!vehicle || !alertType) {
          return null;
        }
        return {
          id: index,
          vehicle: String(vehicle),
          alertType: String(alertType),
          dateLabel: formattedRows[index]?.[dateTimeColumn.field] ?? formatDateLabel(dateValue),
          remarks: remarkColumn ? row[remarkColumn.field] : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .slice(0, 30);
  }, [alertTypeColumn, dateTimeColumn, formattedRows, records, remarkColumn, vehicleColumn]);

  if (!reference) {
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="error">Invalid Google Sheet link for this dashboard.</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quick view of the latest alerts from the Google Sheet.
          </Typography>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Last updated {lastUpdated.toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <Button variant="outlined" onClick={refresh} disabled={loading}>
            Refresh data
          </Button>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ mt: 4 }}>
          {!vehicleColumn || !alertTypeColumn || !dateTimeColumn ? (
            <Alert severity="info">
              Add columns labelled &quot;Vehicle No&quot;, &quot;Alert Type&quot;, and a date/time column to view
              alerts.
            </Alert>
          ) : (
            <Paper
              elevation={2}
              sx={{ overflowX: 'auto', borderRadius: 2, background: alpha('#ffffff', 0.95), p: { xs: 1, sm: 2 } }}
            >
              <Typography variant="h6" gutterBottom sx={{ px: 1, pt: 1 }}>
                Latest alerts
              </Typography>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>Alert type</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.dateLabel}</TableCell>
                      <TableCell>{row.vehicle}</TableCell>
                      <TableCell>{row.alertType}</TableCell>
                      <TableCell>{row.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      )}
    </Container>
  );
}
