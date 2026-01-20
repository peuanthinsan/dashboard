'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import useGoogleSheet from 'app/hooks/useGoogleSheet';
import { parseSheetUrl } from 'app/utils/googleSheet';
import {
  MULTI_SORT_HINT,
  SortState,
  buildMultiSortComparator,
  isMultiSortEvent,
  updateMultiSort,
} from 'app/utils/tableSort';

type DetailDashboardProps = {
  title: string;
  sheetUrl: string;
};

type AlertRow = {
  id: string;
  dateKey: string;
  dateValue: Date;
  dateDisplay: string;
  dateTimeDisplay: string;
  monthKey: string;
  vehicle: string;
  driver: string | null;
  alertType: string;
  speed: number | null;
  remarks: string | null;
  fleet: string | null;
  videoUrl: string | null;
};

const normalizeLabel = (label: string) => (label ? label.trim().toLowerCase() : '');
const normalizeRemark = (value: string | null) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeRemarkKey = (value: string | null) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return normalized.replace(/(?:[-\\s])?a2$/i, '');
};
const resolveRemark = (remark: string | null, alertType: string | null) => {
  const normalizedRemark = normalizeRemark(remark);
  if (normalizedRemark) {
    return String(remark).trim();
  }
  const normalizedAlertType = normalizeLabel(alertType ?? '');
  if (normalizedAlertType === 'forward collision-a2') {
    return 'Forward collision';
  }
  return null;
};
const ALLOWED_ALERT_TYPES = new Set(
  ['Eye Closing-A2', 'Forward Collision-A2', 'Seatbelt-A2'].map((type) => type.toLowerCase()),
);

const formatDateLabel = (value: Date | string) => {
  if (!value) return 'Unspecified';
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString();
};

const formatDateTimeLabel = (value: Date | string) => {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  return String(value);
};

const formatMonthYearLabel = (value: string) => {
  if (!value) return 'Unspecified';
  const [year, month] = String(value).split('-');
  if (!year || !month) return String(value);
  const parsedYear = Number(year);
  const parsedMonthIndex = Number(month) - 1;
  const date = new Date(parsedYear, parsedMonthIndex, 1);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const TARGET_REMARKS = [
  'fatigue',
  'yawning',
  'distraction',
  'smoking',
  'mobile phone',
  'seatbelt',
  'eating/drinking',
  'forward collision',
];
const REMARK_LABELS: Record<string, string> = {
  fatigue: 'Fatigue',
  yawning: 'Yawning',
  distraction: 'Distraction',
  smoking: 'Smoking',
  'mobile phone': 'Mobile phone',
  seatbelt: 'Seatbelt',
  'eating/drinking': 'Eating/Drinking',
  'forward collision': 'Forward collision',
};
const EXCLUDED_REMARKS = new Set(['no video', 'false alert']);

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

export default function DetailDashboard({ title, sheetUrl }: DetailDashboardProps) {
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
      return column.type === 'date' || column.type === 'datetime' || label === 'date' || label.includes('date');
    });
    return fallback || null;
  }, [columns]);
  const speedColumn = useMemo(
    () =>
      findColumn({
        matches: ['speed'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const remarksColumn = useMemo(
    () =>
      findColumn({
        matches: ['remarks', 'remark'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const fleetColumn = useMemo(
    () =>
      findColumn({
        matches: ['fleet'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const videoColumn = useMemo(
    () =>
      findColumn({
        matches: ['videourl', 'video url', 'video'],
        fallbackIndex: null,
      }),
    [findColumn],
  );

  const handleRefresh = () => {
    refresh();
  };

  const [selectedAlertType, setSelectedAlertType] = useState('all');
  const [selectedMonthYear, setSelectedMonthYear] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedFleet, setSelectedFleet] = useState('all');
  const [selectedRemark, setSelectedRemark] = useState('all');

  const resetFilters = () => {
    setSelectedAlertType('all');
    setSelectedMonthYear('all');
    setSelectedVehicle('all');
    setSelectedFleet('all');
    setSelectedRemark('all');
  };

  const alertRows = useMemo<AlertRow[]>(() => {
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
        if (!ALLOWED_ALERT_TYPES.has(String(alertType).trim().toLowerCase())) {
          return null;
        }
        const dateKey = dateValue.toISOString().slice(0, 10);
        const resolvedRemark = resolveRemark(remarksColumn ? (row[remarksColumn.field] as string | null) : null, String(alertType));
        return {
          id: `${index}-${dateKey}`,
          dateKey,
          dateValue,
          dateDisplay: formatDateLabel(dateValue),
          dateTimeDisplay: formattedRows[index]?.[dateTimeColumn.field] ?? formatDateTimeLabel(dateValue),
          monthKey: dateKey.slice(0, 7),
          vehicle: String(vehicle),
          driver: driverColumn ? (row[driverColumn.field] as string | null) : null,
          alertType: String(alertType),
          speed: speedColumn ? (row[speedColumn.field] as number | null) : null,
          remarks: resolvedRemark,
          fleet: fleetColumn ? (row[fleetColumn.field] as string | null) : null,
          videoUrl: videoColumn ? (row[videoColumn.field] as string | null) : null,
        };
      })
      .filter((row): row is AlertRow => {
        if (!row) return false;
        const remarkValue = normalizeRemark(row.remarks);
        if (remarkValue && EXCLUDED_REMARKS.has(remarkValue)) {
          return false;
        }
        return true;
      });
  }, [
    alertTypeColumn,
    dateTimeColumn,
    driverColumn,
    fleetColumn,
    formattedRows,
    records,
    remarksColumn,
    speedColumn,
    vehicleColumn,
    videoColumn,
  ]);

  const alertTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.alertType) unique.add(row.alertType);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [alertRows]);

  const monthYearOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.monthKey) unique.add(row.monthKey);
    });
    return Array.from(unique).sort((a, b) => b.localeCompare(a));
  }, [alertRows]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle) unique.add(row.vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [alertRows]);
  const vehicleFilterOptions = useMemo(() => ['all', ...vehicleOptions], [vehicleOptions]);

  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet) unique.add(row.fleet);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [alertRows]);

  const remarkOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.remarks) unique.add(row.remarks);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [alertRows]);

  useEffect(() => {
    if (selectedAlertType !== 'all' && !alertTypeOptions.includes(selectedAlertType)) {
      setSelectedAlertType('all');
    }
  }, [alertTypeOptions, selectedAlertType]);

  useEffect(() => {
    if (selectedMonthYear !== 'all' && !monthYearOptions.includes(selectedMonthYear)) {
      setSelectedMonthYear('all');
    }
  }, [monthYearOptions, selectedMonthYear]);

  useEffect(() => {
    if (selectedVehicle !== 'all' && !vehicleOptions.includes(selectedVehicle)) {
      setSelectedVehicle('all');
    }
  }, [selectedVehicle, vehicleOptions]);

  useEffect(() => {
    if (selectedFleet !== 'all' && !fleetOptions.includes(selectedFleet)) {
      setSelectedFleet('all');
    }
  }, [fleetOptions, selectedFleet]);

  useEffect(() => {
    if (selectedRemark !== 'all' && !remarkOptions.includes(selectedRemark)) {
      setSelectedRemark('all');
    }
  }, [remarkOptions, selectedRemark]);

  const filteredAlerts = useMemo(() => {
    let filtered = alertRows;
    if (selectedAlertType !== 'all') {
      filtered = filtered.filter((row) => row.alertType === selectedAlertType);
    }
    if (selectedMonthYear !== 'all') {
      filtered = filtered.filter((row) => row.monthKey === selectedMonthYear);
    }
    if (selectedVehicle !== 'all') {
      filtered = filtered.filter((row) => row.vehicle === selectedVehicle);
    }
    if (selectedFleet !== 'all') {
      filtered = filtered.filter((row) => row.fleet === selectedFleet);
    }
    if (selectedRemark !== 'all') {
      filtered = filtered.filter((row) => row.remarks === selectedRemark);
    }
    return filtered;
  }, [alertRows, selectedAlertType, selectedMonthYear, selectedVehicle, selectedFleet, selectedRemark]);

  const dailyTrend = useMemo(() => {
    const totals = new Map<string, number>();
    filteredAlerts.forEach((row) => {
      const current = totals.get(row.dateKey) ?? 0;
      totals.set(row.dateKey, current + 1);
    });
    return Array.from(totals.entries())
      .map(([dateKey, total]) => ({
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        total,
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [filteredAlerts]);

  const vehicleSummary = useMemo(() => {
    const totals = new Map<string, number>();
    filteredAlerts.forEach((row) => {
      const current = totals.get(row.vehicle) ?? 0;
      totals.set(row.vehicle, current + 1);
    });
    return Array.from(totals.entries())
      .map(([vehicle, total]) => ({ vehicle, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAlerts]);

  const remarkFleetSummary = useMemo(() => {
    const fleetTotals = new Map<string, Map<string, number>>();
    const remarkTypes = new Set<string>();
    const fleets = new Set<string>();

    filteredAlerts.forEach((row) => {
      const fleetLabel = row.fleet ? String(row.fleet) : 'Unspecified fleet';
      if (!row.remarks) {
        return;
      }
      const remarkLabel = String(row.remarks);
      fleets.add(fleetLabel);
      remarkTypes.add(remarkLabel);

      if (!fleetTotals.has(fleetLabel)) {
        fleetTotals.set(fleetLabel, new Map());
      }
      const remarkTotals = fleetTotals.get(fleetLabel);
      const current = remarkTotals?.get(remarkLabel) ?? 0;
      remarkTotals?.set(remarkLabel, current + 1);
    });

    const fleetList = Array.from(fleets).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const remarkList = Array.from(remarkTypes).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const remarkColors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.info.main,
      theme.palette.error.main,
    ];

    return {
      fleets: fleetList,
      remarks: remarkList,
      series: remarkList.map((remark, index) => ({
        label: remark,
        data: fleetList.map((fleet) => fleetTotals.get(fleet)?.get(remark) ?? 0),
        stack: 'remarks',
        color: remarkColors[index % remarkColors.length],
      })),
    };
  }, [filteredAlerts, theme]);

  const monthOverMonthSummary = useMemo(() => {
    if (!remarksColumn || !dateTimeColumn || !alertTypeColumn) {
      return { rows: [], currentMonth: null, previousMonth: null };
    }
    const totals = new Map<string, Map<string, number>>();
    alertRows.forEach((row) => {
      const normalizedAlertType = normalizeLabel(row.alertType);
      if (!ALLOWED_ALERT_TYPES.has(normalizedAlertType)) {
        return;
      }
      if (selectedVehicle !== 'all' && row.vehicle !== selectedVehicle) {
        return;
      }
      if (selectedFleet !== 'all' && row.fleet !== selectedFleet) {
        return;
      }
      const remarkValue = normalizeRemarkKey(row.remarks);
      if (!TARGET_REMARKS.includes(remarkValue)) {
        return;
      }
      const monthKey = row.monthKey;
      if (!monthKey) {
        return;
      }
      if (!totals.has(monthKey)) {
        totals.set(monthKey, new Map());
      }
      const monthTotals = totals.get(monthKey);
      monthTotals?.set(remarkValue, (monthTotals?.get(remarkValue) ?? 0) + 1);
    });

    const months = Array.from(totals.keys()).sort((a, b) => b.localeCompare(a));
    const resolvedCurrentMonth =
      selectedMonthYear !== 'all' && months.includes(selectedMonthYear) ? selectedMonthYear : months[0] ?? null;
    const currentIndex = resolvedCurrentMonth ? months.indexOf(resolvedCurrentMonth) : -1;
    const previousMonth = currentIndex >= 0 ? months[currentIndex + 1] ?? null : null;

    const rows = TARGET_REMARKS.map((remark) => {
      const current = resolvedCurrentMonth ? totals.get(resolvedCurrentMonth)?.get(remark) ?? 0 : 0;
      const previous = previousMonth ? totals.get(previousMonth)?.get(remark) ?? 0 : 0;
      return {
        remark,
        label: REMARK_LABELS[remark],
        current,
        previous,
        delta: current - previous,
      };
    });

    return { rows, currentMonth: resolvedCurrentMonth, previousMonth };
  }, [alertRows, alertTypeColumn, dateTimeColumn, remarksColumn, selectedFleet, selectedMonthYear, selectedVehicle]);

  const [alertsPage, setAlertsPage] = useState(0);
  const [alertsRowsPerPage, setAlertsRowsPerPage] = useState(25);
  const [alertsSorts, setAlertsSorts] = useState<SortState[]>([{ id: 'dateTime', direction: 'desc' }]);

  useEffect(() => {
    setAlertsPage(0);
  }, [selectedAlertType, selectedMonthYear, selectedVehicle, selectedFleet, selectedRemark]);

  useEffect(() => {
    if (alertsRowsPerPage === -1) {
      if (alertsPage !== 0) {
        setAlertsPage(0);
      }
      return;
    }
    const maxPage = Math.max(0, Math.ceil(filteredAlerts.length / alertsRowsPerPage) - 1);
    if (alertsPage > maxPage) {
      setAlertsPage(maxPage);
    }
  }, [alertsPage, alertsRowsPerPage, filteredAlerts.length]);

  const alertsSortComparator = useMemo(
    () =>
      buildMultiSortComparator(alertsSorts, {
        dateTime: (row: AlertRow) => row.dateValue,
        vehicle: (row: AlertRow) => row.vehicle,
        driver: (row: AlertRow) => row.driver || '',
        alert: (row: AlertRow) => row.alertType,
        speed: (row: AlertRow) => row.speed ?? 0,
        remarks: (row: AlertRow) => row.remarks || '',
        video: (row: AlertRow) => row.videoUrl || '',
      }),
    [alertsSorts],
  );

  const sortedAlerts = useMemo(() => {
    if (!alertsSortComparator) return filteredAlerts;
    return [...filteredAlerts].sort(alertsSortComparator);
  }, [alertsSortComparator, filteredAlerts]);

  const paginatedAlerts = useMemo(() => {
    if (alertsRowsPerPage === -1) {
      return sortedAlerts;
    }
    const start = alertsPage * alertsRowsPerPage;
    return sortedAlerts.slice(start, start + alertsRowsPerPage);
  }, [alertsPage, alertsRowsPerPage, sortedAlerts]);

  const handleAlertsSort = (columnId: string) => (event: React.MouseEvent<HTMLElement>) => {
    setAlertsSorts((prev) => updateMultiSort(prev, columnId, isMultiSortEvent(event)));
  };

  const getAlertsSortDirection = (columnId: string) =>
    alertsSorts.find((sort) => sort.id === columnId)?.direction ?? false;

  const columnVisualStyles = useMemo(() => {
    const palette = theme.palette;
    const legend = (palette as typeof palette & { appEngineLegend?: Record<string, string> }).appEngineLegend || {};
    return {
      Date: {
        header: {
          backgroundColor: legend.purple || palette.secondary.main,
          color: palette.getContrastText(legend.purple || palette.secondary.main),
        },
      },
      Vehicle: {
        header: {
          backgroundColor: legend.teal || palette.info.main,
          color: palette.getContrastText(legend.teal || palette.info.main),
        },
      },
      Alert: {
        header: {
          backgroundColor: legend.blue || palette.primary.main,
          color: palette.getContrastText(legend.blue || palette.primary.main),
        },
      },
      Speed: {
        header: {
          backgroundColor: legend.green || palette.success.main,
          color: palette.getContrastText(legend.green || palette.success.main),
        },
      },
    };
  }, [theme]);

  const chartAccentColors = useMemo(() => {
    const legend =
      (theme.palette as typeof theme.palette & { appEngineLegend?: Record<string, string> }).appEngineLegend || {};
    return {
      line: legend.purple || theme.palette.secondary.main,
      bar: legend.teal || theme.palette.info.main,
    };
  }, [theme]);

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
            Monitor alert volume by vehicle, date, fleet, alert type, and remarks for the video telemetry feed.
          </Typography>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Last updated {lastUpdated.toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <Button variant="outlined" onClick={handleRefresh} disabled={loading}>
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
              alert trends.
            </Alert>
          ) : (
            <>
              <Paper
                elevation={2}
                sx={{
                  mb: 3,
                  p: { xs: 2, sm: 3 },
                  background: alpha(theme.palette.background.paper, 0.95),
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Filters
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Narrow alerts by alert type, remark, month, fleet, or vehicle.
                    </Typography>
                  </Box>
                  <Button variant="text" onClick={resetFilters} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                    Reset filters
                  </Button>
                </Stack>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mt: 2 }}
                >
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Alert type"
                    value={selectedAlertType}
                    onChange={(event) => setSelectedAlertType(event.target.value)}
                    sx={{ maxWidth: { md: 240 } }}
                  >
                    <MenuItem value="all">All alert types</MenuItem>
                    {alertTypeOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Filter by month"
                    value={selectedMonthYear}
                    onChange={(event) => setSelectedMonthYear(event.target.value)}
                    sx={{ maxWidth: { md: 220 } }}
                  >
                    <MenuItem value="all">All months</MenuItem>
                    {monthYearOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {formatMonthYearLabel(option)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Filter by fleet"
                    value={selectedFleet}
                    onChange={(event) => setSelectedFleet(event.target.value)}
                    sx={{ maxWidth: { md: 260 } }}
                  >
                    <MenuItem value="all">All fleets</MenuItem>
                    {fleetOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Filter by remark"
                    value={selectedRemark}
                    onChange={(event) => setSelectedRemark(event.target.value)}
                    sx={{ maxWidth: { md: 240 } }}
                  >
                    <MenuItem value="all">All remarks</MenuItem>
                    {remarkOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={vehicleFilterOptions}
                    value={selectedVehicle}
                    onChange={(_, value) => setSelectedVehicle(value ?? 'all')}
                    getOptionLabel={(option) => (option === 'all' ? 'All vehicles' : option)}
                    isOptionEqualToValue={(option, value) => option === value}
                    renderInput={(params) => <TextField {...params} label="Filter by vehicle" />}
                    sx={{ maxWidth: { md: 220 } }}
                  />
                </Stack>
              </Paper>
              {alertRows.length === 0 ? (
                <Alert severity="info">No alert rows were found for the current sheet.</Alert>
              ) : (
                <>
                  <Paper
                    elevation={2}
                    sx={{
                      mb: 3,
                      p: { xs: 2, sm: 3 },
                      background: alpha(theme.palette.background.paper, 0.95),
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Alert remark highlights
                    </Typography>
                    {!remarksColumn || !dateTimeColumn || !alertTypeColumn ? (
                      <Alert severity="info">
                        Add &quot;Remarks&quot;, &quot;Alert Type&quot;, and a date/time column to compare remark totals
                        month over month.
                      </Alert>
                    ) : !monthOverMonthSummary.currentMonth ? (
                      <Alert severity="info">No monthly remark totals are available yet.</Alert>
                    ) : (
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Showing {formatMonthYearLabel(monthOverMonthSummary.currentMonth)} totals with change versus
                          last month.
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                            gap: 2,
                          }}
                        >
                          {monthOverMonthSummary.rows.map((row) => {
                            const deltaColor =
                              row.delta > 0
                                ? theme.palette.success.main
                                : row.delta < 0
                                ? theme.palette.error.main
                                : theme.palette.text.secondary;
                            const deltaIcon = row.delta > 0 ? '▲' : row.delta < 0 ? '▼' : '→';
                            const deltaLabel = `${row.delta > 0 ? '+' : ''}${row.delta.toLocaleString()}`;
                            const percentLabel =
                              row.previous === 0
                                ? row.current === 0
                                  ? '0%'
                                  : '—'
                                : `${row.delta > 0 ? '+' : ''}${((row.delta / row.previous) * 100).toFixed(1)}%`;
                            return (
                              <Paper
                                key={row.remark}
                                elevation={1}
                                sx={{ p: 2, borderRadius: 2, background: alpha(theme.palette.primary.light, 0.08) }}
                              >
                                <Typography variant="subtitle2" color="text.secondary">
                                  {row.label}
                                </Typography>
                                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700 }}>
                                  {row.current.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1, color: deltaColor, fontWeight: 600 }}>
                                  {deltaIcon} {deltaLabel} from last month
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: deltaColor }}>
                                  {percentLabel} change
                                </Typography>
                              </Paper>
                            );
                          })}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                  {filteredAlerts.length === 0 ? (
                    <Alert severity="info">No alerts match the selected filters.</Alert>
                  ) : (
                    <>
                      <Paper
                        elevation={2}
                        sx={{
                          mb: 3,
                          p: { xs: 2, sm: 3 },
                          background: alpha(theme.palette.background.paper, 0.95),
                        }}
                      >
                        <Typography variant="h6" gutterBottom>
                          Daily alert trend
                        </Typography>
                        {dailyTrend.length === 0 ? (
                          <Alert severity="info">No daily alerts are available for the selected filters.</Alert>
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
                                color: chartAccentColors.line,
                              },
                            ]}
                            margin={{ top: 20, bottom: 40, left: 40, right: 20 }}
                          />
                        )}
                      </Paper>

                      <Paper
                        elevation={2}
                        sx={{
                          mb: 3,
                          p: { xs: 2, sm: 3 },
                          background: alpha(theme.palette.background.paper, 0.95),
                        }}
                      >
                        <Typography variant="h6" gutterBottom>
                          Remarks by fleet
                        </Typography>
                        {!fleetColumn || !remarksColumn ? (
                          <Alert severity="info">Add &quot;Fleet&quot; and &quot;Remarks&quot; columns to compare remark totals by fleet.</Alert>
                        ) : remarkFleetSummary.fleets.length === 0 || remarkFleetSummary.remarks.length === 0 ? (
                          <Alert severity="info">No remark summary data available for the selected filters.</Alert>
                        ) : (
                          <BarChart
                            height={360}
                            xAxis={[
                              {
                                data: remarkFleetSummary.fleets,
                                scaleType: 'band',
                              },
                            ]}
                            series={remarkFleetSummary.series}
                            legend={{
                              direction: 'row',
                              position: { vertical: 'bottom', horizontal: 'middle' },
                            }}
                            slotProps={{
                              legend: {
                                sx: {
                                  flexWrap: 'nowrap',
                                  justifyContent: 'center',
                                  overflowX: 'auto',
                                  width: '100%',
                                },
                              },
                            }}
                            margin={{ top: 20, bottom: 120, left: 40, right: 20 }}
                          />
                        )}
                      </Paper>

                      <Paper
                        elevation={2}
                        sx={{
                          mb: 3,
                          p: { xs: 2, sm: 3 },
                          background: alpha(theme.palette.background.paper, 0.95),
                        }}
                      >
                        <Typography variant="h6" gutterBottom>
                          Top vehicles by alert count
                        </Typography>
                        {vehicleSummary.length === 0 ? (
                          <Alert severity="info">No vehicle summary data available.</Alert>
                        ) : (
                          <BarChart
                            height={320}
                            xAxis={[
                              {
                                data: vehicleSummary.map((row) => row.vehicle),
                                scaleType: 'band',
                              },
                            ]}
                            series={[
                              {
                                label: selectedRemark === 'all' ? 'Alerts' : `${selectedRemark} alerts`,
                                data: vehicleSummary.map((row) => row.total),
                                color: chartAccentColors.bar,
                              },
                            ]}
                            margin={{ top: 20, bottom: 80, left: 40, right: 20 }}
                          />
                        )}
                      </Paper>

                      <Paper
                        elevation={2}
                        sx={{
                          overflowX: 'auto',
                          borderRadius: 2,
                          boxShadow: theme.shadows[2],
                          background: alpha(theme.palette.background.paper, 0.95),
                          p: { xs: 1, sm: 2 },
                        }}
                      >
                        <Typography variant="h6" gutterBottom sx={{ px: 1, pt: 1 }}>
                          Recent alerts
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ px: 1, pb: 1 }}>
                          {MULTI_SORT_HINT}
                        </Typography>
                        <Table size="small" sx={{ minWidth: 820 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell
                                sx={{ ...columnVisualStyles.Date.header, fontWeight: 700 }}
                                sortDirection={getAlertsSortDirection('dateTime') || false}
                              >
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('dateTime'))}
                                  direction={getAlertsSortDirection('dateTime') || 'asc'}
                                  onClick={handleAlertsSort('dateTime')}
                                >
                                  Alert time
                                </TableSortLabel>
                              </TableCell>
                              <TableCell
                                sx={{ ...columnVisualStyles.Vehicle.header, fontWeight: 700 }}
                                sortDirection={getAlertsSortDirection('vehicle') || false}
                              >
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('vehicle'))}
                                  direction={getAlertsSortDirection('vehicle') || 'asc'}
                                  onClick={handleAlertsSort('vehicle')}
                                >
                                  Vehicle
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }} sortDirection={getAlertsSortDirection('driver') || false}>
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('driver'))}
                                  direction={getAlertsSortDirection('driver') || 'asc'}
                                  onClick={handleAlertsSort('driver')}
                                >
                                  Driver
                                </TableSortLabel>
                              </TableCell>
                              <TableCell
                                sx={{ ...columnVisualStyles.Alert.header, fontWeight: 700 }}
                                sortDirection={getAlertsSortDirection('alert') || false}
                              >
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('alert'))}
                                  direction={getAlertsSortDirection('alert') || 'asc'}
                                  onClick={handleAlertsSort('alert')}
                                >
                                  Alert type
                                </TableSortLabel>
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ ...columnVisualStyles.Speed.header, fontWeight: 700 }}
                                sortDirection={getAlertsSortDirection('speed') || false}
                              >
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('speed'))}
                                  direction={getAlertsSortDirection('speed') || 'asc'}
                                  onClick={handleAlertsSort('speed')}
                                >
                                  Speed
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }} sortDirection={getAlertsSortDirection('remarks') || false}>
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('remarks'))}
                                  direction={getAlertsSortDirection('remarks') || 'asc'}
                                  onClick={handleAlertsSort('remarks')}
                                >
                                  Remarks
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }} sortDirection={getAlertsSortDirection('video') || false}>
                                <TableSortLabel
                                  active={Boolean(getAlertsSortDirection('video'))}
                                  direction={getAlertsSortDirection('video') || 'asc'}
                                  onClick={handleAlertsSort('video')}
                                >
                                  Video
                                </TableSortLabel>
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedAlerts.map((row) => (
                              <TableRow
                                key={row.id}
                                sx={{
                                  '&:nth-of-type(odd)': {
                                    backgroundColor: alpha(theme.palette.primary.light, 0.06),
                                  },
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.light, 0.14),
                                  },
                                  transition: theme.transitions.create('background-color', {
                                    duration: theme.transitions.duration.shorter,
                                  }),
                                }}
                              >
                                <TableCell sx={{ fontWeight: 600 }}>{row.dateTimeDisplay}</TableCell>
                                <TableCell sx={{ fontWeight: 500 }}>{row.vehicle}</TableCell>
                                <TableCell>{row.driver || '—'}</TableCell>
                                <TableCell>
                                  <Chip label={row.alertType} size="small" color="info" variant="outlined" />
                                </TableCell>
                                <TableCell align="right">
                                  {row.speed != null ? row.speed.toLocaleString() : '—'}
                                </TableCell>
                                <TableCell>{row.remarks || '—'}</TableCell>
                                <TableCell>
                                  {row.videoUrl ? (
                                    <Button
                                      size="small"
                                      variant="text"
                                      component="a"
                                      href={row.videoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      View
                                    </Button>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <TablePagination
                          component="div"
                          count={filteredAlerts.length}
                          page={alertsPage}
                          onPageChange={(_, newPage) => setAlertsPage(newPage)}
                          rowsPerPage={alertsRowsPerPage}
                          onRowsPerPageChange={(event) => {
                            setAlertsRowsPerPage(Number(event.target.value));
                            setAlertsPage(0);
                          }}
                          rowsPerPageOptions={[25, 50, 100, { label: 'All', value: -1 }]}
                        />
                      </Paper>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Box>
      )}
    </Container>
  );
}
