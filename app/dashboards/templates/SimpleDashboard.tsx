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
import { alpha, useTheme } from '@mui/material/styles';
import useGoogleSheet from '../hooks/useGoogleSheet';

type SimpleDashboardProps = {
  name: string;
  sheetId: string;
  gid: string;
};

const normalizeLabel = (label: string) => label.trim().toLowerCase();

const buildColumnFinder =
  (columns: { label: string; field: string }[]) =>
  (matches: string[], fallbackIndex: number | null) => {
    const match = columns.find((column) => {
      const normalized = normalizeLabel(column.label);
      return matches.some((target) => normalized === target || normalized.includes(target));
    });
    if (match) return match;
    if (fallbackIndex == null) return null;
    return columns[fallbackIndex] || null;
  };

export default function SimpleDashboard({ name, sheetId, gid }: SimpleDashboardProps) {
  const theme = useTheme();
  const { columns, records, formattedRows, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId,
    gid,
  });

  const findColumn = useMemo(() => buildColumnFinder(columns), [columns]);

  const dateTimeColumn = useMemo(() => findColumn(['alert date time', 'track time', 'date'], 1), [findColumn]);
  const vehicleColumn = useMemo(() => findColumn(['vehicle no', 'vehicle'], 0), [findColumn]);
  const alertTypeColumn = useMemo(() => findColumn(['alert type', 'alert'], 2), [findColumn]);
  const remarksColumn = useMemo(() => findColumn(['remarks', 'remark'], null), [findColumn]);

  const rows = useMemo(() => {
    if (!dateTimeColumn || !alertTypeColumn) return [];
    return records.slice(0, 12).map((row, index) => ({
      id: `${index}`,
      dateTime: formattedRows[index]?.[dateTimeColumn.field] ?? String(row[dateTimeColumn.field] ?? ''),
      vehicle: vehicleColumn ? row[vehicleColumn.field] : null,
      alertType: row[alertTypeColumn.field],
      remarks: remarksColumn ? row[remarksColumn.field] : null,
    }));
  }, [alertTypeColumn, dateTimeColumn, formattedRows, records, remarksColumn, vehicleColumn]);

  const totalAlerts = useMemo(() => records.length, [records.length]);

  return (
    <Container sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quick view of the latest alerts and key metadata.
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
          <Paper sx={{ p: 3, mb: 3, background: alpha(theme.palette.primary.main, 0.05) }}>
            <Typography variant="overline" color="text.secondary">
              Total alerts
            </Typography>
            <Typography variant="h4">{totalAlerts.toLocaleString()}</Typography>
          </Paper>

          <Paper sx={{ p: { xs: 1, sm: 2 }, background: alpha(theme.palette.background.paper, 0.95) }}>
            <Typography variant="h6" gutterBottom sx={{ px: 1, pt: 1 }}>
              Latest alerts
            </Typography>
            {rows.length === 0 ? (
              <Alert severity="info">No rows available for this sheet.</Alert>
            ) : (
              <Table size="small" sx={{ minWidth: 680 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Alert type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.dateTime}</TableCell>
                      <TableCell>{row.vehicle ?? '—'}</TableCell>
                      <TableCell>{row.alertType ?? '—'}</TableCell>
                      <TableCell>{row.remarks ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Box>
      )}
    </Container>
  );
}
