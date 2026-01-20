'use client';

import { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import useGoogleSheet from '../hooks/useGoogleSheet';

type SummaryDashboardProps = {
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

const formatDateLabel = (value: unknown) => {
  if (!value) return 'Unspecified';
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString();
};

export default function SummaryDashboard({ name, sheetId, gid }: SummaryDashboardProps) {
  const theme = useTheme();
  const { columns, records, formattedRows, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId,
    gid,
  });

  const findColumn = useMemo(() => buildColumnFinder(columns), [columns]);

  const alertTypeColumn = useMemo(
    () => findColumn(['alert type', 'alert'], 2),
    [findColumn],
  );
  const dateTimeColumn = useMemo(
    () => findColumn(['alert date time', 'track time', 'date'], null),
    [findColumn],
  );
  const vehicleColumn = useMemo(() => findColumn(['vehicle no', 'vehicle'], 0), [findColumn]);
  const driverColumn = useMemo(() => findColumn(['driver name', 'driver'], null), [findColumn]);
  const speedColumn = useMemo(() => findColumn(['speed'], null), [findColumn]);

  const alertRows = useMemo(() => {
    if (!alertTypeColumn || !dateTimeColumn) return [];
    return records
      .map((row, index) => {
        const dateValue = row[dateTimeColumn.field];
        const alertType = row[alertTypeColumn.field];
        if (!dateValue || !alertType) return null;
        return {
          id: `${index}`,
          dateValue,
          dateLabel: formatDateLabel(dateValue),
          alertType: String(alertType),
          vehicle: vehicleColumn ? row[vehicleColumn.field] : null,
          driver: driverColumn ? row[driverColumn.field] : null,
          speed: speedColumn ? row[speedColumn.field] : null,
          dateTimeDisplay: formattedRows[index]?.[dateTimeColumn.field] ?? String(dateValue),
        };
      })
      .filter(Boolean) as {
      id: string;
      dateValue: string | Date | number;
      dateLabel: string;
      alertType: string;
      vehicle: string | number | null;
      driver: string | number | null;
      speed: string | number | null;
      dateTimeDisplay: string;
    }[];
  }, [alertTypeColumn, dateTimeColumn, driverColumn, formattedRows, records, speedColumn, vehicleColumn]);

  const totals = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle) vehicles.add(String(row.vehicle));
      if (row.driver) drivers.add(String(row.driver));
    });
    return {
      totalAlerts: alertRows.length,
      vehicles: vehicles.size,
      drivers: drivers.size,
    };
  }, [alertRows]);

  const alertTypeSummary = useMemo(() => {
    const counts = new Map<string, number>();
    alertRows.forEach((row) => {
      counts.set(row.alertType, (counts.get(row.alertType) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [alertRows]);

  const dailyTrend = useMemo(() => {
    const counts = new Map<string, number>();
    alertRows.forEach((row) => {
      counts.set(row.dateLabel, (counts.get(row.dateLabel) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, total]) => ({ label, total }));
  }, [alertRows]);

  const latestRows = useMemo(() => alertRows.slice(0, 8), [alertRows]);

  return (
    <Container sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Summary of alert volume by day, alert type, and key driver activity.
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Card sx={{ flex: 1, background: alpha(theme.palette.primary.main, 0.08) }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Total alerts
                </Typography>
                <Typography variant="h4">{totals.totalAlerts.toLocaleString()}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: alpha(theme.palette.info.main, 0.08) }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Vehicles monitored
                </Typography>
                <Typography variant="h4">{totals.vehicles.toLocaleString()}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: alpha(theme.palette.success.main, 0.08) }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Active drivers
                </Typography>
                <Typography variant="h4">{totals.drivers.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Stack>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ mt: 3 }}>
            <Paper sx={{ flex: 1, p: 3, background: alpha(theme.palette.background.paper, 0.95) }}>
              <Typography variant="h6" gutterBottom>
                Alert volume by day
              </Typography>
              {dailyTrend.length === 0 ? (
                <Alert severity="info">No daily trend data available yet.</Alert>
              ) : (
                <LineChart
                  height={300}
                  xAxis={[
                    {
                      data: dailyTrend.map((row) => row.label),
                      scaleType: 'band',
                    },
                  ]}
                  series={[
                    {
                      data: dailyTrend.map((row) => row.total),
                      color: theme.palette.primary.main,
                    },
                  ]}
                  margin={{ top: 20, bottom: 40, left: 40, right: 20 }}
                />
              )}
            </Paper>
            <Paper sx={{ flex: 1, p: 3, background: alpha(theme.palette.background.paper, 0.95) }}>
              <Typography variant="h6" gutterBottom>
                Alerts by type
              </Typography>
              {alertTypeSummary.length === 0 ? (
                <Alert severity="info">No alert types found yet.</Alert>
              ) : (
                <BarChart
                  height={300}
                  xAxis={[
                    {
                      data: alertTypeSummary.map((row) => row.label),
                      scaleType: 'band',
                    },
                  ]}
                  series={[
                    {
                      data: alertTypeSummary.map((row) => row.total),
                      color: theme.palette.secondary.main,
                    },
                  ]}
                  margin={{ top: 20, bottom: 80, left: 40, right: 20 }}
                />
              )}
            </Paper>
          </Stack>

          <Paper sx={{ mt: 3, p: 3, background: alpha(theme.palette.background.paper, 0.95) }}>
            <Typography variant="h6" gutterBottom>
              Recent alerts
            </Typography>
            {latestRows.length === 0 ? (
              <Alert severity="info">No alert rows found in the sheet.</Alert>
            ) : (
              <Stack spacing={1}>
                {latestRows.map((row) => (
                  <Box
                    key={row.id}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                      gap: 1,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      pb: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2">{row.alertType}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {row.dateTimeDisplay}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Vehicle {row.vehicle ?? '—'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Speed {row.speed ?? '—'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      )}
    </Container>
  );
}
