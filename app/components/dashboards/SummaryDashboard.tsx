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
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import useGoogleSheet from 'app/hooks/useGoogleSheet';
import { parseSheetUrl } from 'app/utils/googleSheet';

type SummaryDashboardProps = {
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
    return value.toLocaleDateString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString();
};

export default function SummaryDashboard({ title, sheetUrl }: SummaryDashboardProps) {
  const theme = useTheme();
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
  const driverColumn = useMemo(
    () =>
      findColumn({
        matches: ['driver name', 'driver'],
        fallbackIndex: null,
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
          driver: driverColumn ? row[driverColumn.field] : null,
          alertType: String(alertType),
          dateValue,
          dateLabel: formattedRows[index]?.[dateTimeColumn.field] ?? formatDateLabel(dateValue),
          remarks: remarkColumn ? row[remarkColumn.field] : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [alertTypeColumn, dateTimeColumn, driverColumn, formattedRows, records, remarkColumn, vehicleColumn]);

  const summaryStats = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    const alertTotals = new Map<string, number>();
    alerts.forEach((alert) => {
      vehicles.add(alert.vehicle);
      if (alert.driver) drivers.add(String(alert.driver));
      alertTotals.set(alert.alertType, (alertTotals.get(alert.alertType) ?? 0) + 1);
    });
    const topAlertType = Array.from(alertTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    return {
      totalAlerts: alerts.length,
      totalVehicles: vehicles.size,
      totalDrivers: drivers.size,
      topAlertType,
    };
  }, [alerts]);

  const dailyTrend = useMemo(() => {
    const totals = new Map<string, number>();
    alerts.forEach((alert) => {
      const key = alert.dateValue.toISOString().slice(0, 10);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    });
    return Array.from(totals.entries())
      .map(([dateKey, total]) => ({
        dateLabel: formatDateLabel(dateKey),
        total,
        dateKey,
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [alerts]);

  const alertTypeSummary = useMemo(() => {
    const totals = new Map<string, number>();
    alerts.forEach((alert) => {
      totals.set(alert.alertType, (totals.get(alert.alertType) ?? 0) + 1);
    });
    return Array.from(totals.entries())
      .map(([alertType, total]) => ({ alertType, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [alerts]);

  const recentAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => b.dateValue.getTime() - a.dateValue.getTime()).slice(0, 8);
  }, [alerts]);

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
            Explore alert trends by vehicle, date, and remarks to spot fatigue and distraction patterns.
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
              summary insights.
            </Alert>
          ) : (
            <>
              <Paper
                elevation={2}
                sx={{ mb: 3, p: { xs: 2, sm: 3 }, background: alpha(theme.palette.background.paper, 0.95) }}
              >
                <Typography variant="h6" gutterBottom>
                  Monthly remark highlights
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2,
                    mt: 1,
                  }}
                >
                  {[
                    { label: 'Total alerts', value: summaryStats.totalAlerts },
                    { label: 'Active vehicles', value: summaryStats.totalVehicles },
                    { label: 'Drivers spotted', value: summaryStats.totalDrivers },
                    { label: 'Top alert type', value: summaryStats.topAlertType },
                  ].map((card) => (
                    <Paper
                      key={card.label}
                      elevation={1}
                      sx={{ p: 2, borderRadius: 2, background: alpha(theme.palette.primary.light, 0.08) }}
                    >
                      <Typography variant="subtitle2" color="text.secondary">
                        {card.label}
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700 }}>
                        {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Paper>

              <Paper
                elevation={2}
                sx={{ mb: 3, p: { xs: 2, sm: 3 }, background: alpha(theme.palette.background.paper, 0.95) }}
              >
                <Typography variant="h6" gutterBottom>
                  Daily alert trend
                </Typography>
                {dailyTrend.length === 0 ? (
                  <Alert severity="info">No daily alerts are available.</Alert>
                ) : (
                  <LineChart
                    height={280}
                    xAxis={[
                      {
                        data: dailyTrend.map((row) => row.dateLabel),
                        scaleType: 'band',
                      },
                    ]}
                    series={[
                      {
                        data: dailyTrend.map((row) => row.total),
                        color: theme.palette.secondary.main,
                      },
                    ]}
                    margin={{ top: 20, bottom: 40, left: 40, right: 20 }}
                  />
                )}
              </Paper>

              <Paper
                elevation={2}
                sx={{ mb: 3, p: { xs: 2, sm: 3 }, background: alpha(theme.palette.background.paper, 0.95) }}
              >
                <Typography variant="h6" gutterBottom>
                  Alert mix by type
                </Typography>
                {alertTypeSummary.length === 0 ? (
                  <Alert severity="info">No alert type data available.</Alert>
                ) : (
                  <BarChart
                    height={320}
                    xAxis={[
                      {
                        data: alertTypeSummary.map((row) => row.alertType),
                        scaleType: 'band',
                      },
                    ]}
                    series={[
                      {
                        label: 'Alerts',
                        data: alertTypeSummary.map((row) => row.total),
                        color: theme.palette.info.main,
                      },
                    ]}
                    margin={{ top: 20, bottom: 80, left: 40, right: 20 }}
                  />
                )}
              </Paper>

              <Paper
                elevation={2}
                sx={{ overflowX: 'auto', borderRadius: 2, background: alpha(theme.palette.background.paper, 0.95) }}
              >
                <Typography variant="h6" gutterBottom sx={{ px: 2, pt: 2 }}>
                  Recent alerts
                </Typography>
                <Table size="small" sx={{ minWidth: 780 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Vehicle</TableCell>
                      <TableCell>Driver</TableCell>
                      <TableCell>Alert type</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentAlerts.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.dateLabel}</TableCell>
                        <TableCell>{row.vehicle}</TableCell>
                        <TableCell>{row.driver || '—'}</TableCell>
                        <TableCell>{row.alertType}</TableCell>
                        <TableCell>{row.remarks || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </>
          )}
        </Box>
      )}
    </Container>
  );
}
