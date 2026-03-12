export type TrendDatum = {
  key: string;
  date: Date;
  count: number;
};

export type TrendPoint = {
  x: number;
  y: number;
  count: number;
  label: string;
};

export type TrendGeometry = {
  points: TrendPoint[];
  path: string;
  viewBox: string;
  padding: { top: number; right: number; bottom: number; left: number };
  width: number;
  height: number;
};

type TrendLabel = {
  label: string;
  position: number;
};

type Row = Record<string, any>;

const normalizedKeyCache = new WeakMap<Row, Map<string, string>>();

export const normalizeLabel = (value: string) => value.trim().toLowerCase();

const getNormalizedKeyMap = (row: Row) => {
  const cached = normalizedKeyCache.get(row);
  if (cached) return cached;
  const map = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    const normalized = normalizeLabel(key);
    if (!map.has(normalized)) {
      map.set(normalized, key);
    }
  });
  normalizedKeyCache.set(row, map);
  return map;
};

export const findValue = (row: Row, labels: string[]) => {
  const keyMap = getNormalizedKeyMap(row);
  for (const label of labels) {
    const key = keyMap.get(normalizeLabel(label));
    if (key) return row[key];
  }
  return null;
};

export const toDisplayString = (value: unknown) => {
  if (value == null || value === '') return '—';
  return String(value);
};

export const hasRemark = (value: string) => value !== '—' && value.trim() !== '';

export const isExcludedAlertRemark = (value: string) => {
  if (!hasRemark(value)) return false;
  const normalizedValue = normalizeLabel(value);
  return (
    normalizedValue.includes('false alert') ||
    normalizedValue.includes('no video') ||
    normalizedValue.includes('no-video')
  );
};

export const parseDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const toMonthLabel = (date: Date) =>
  date.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

export const toDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const ALLOWED_ALERT_TYPES = [
  'Distraction-A2',
  'Eye Closing-A2',
  'Yawning-A2',
  'OverSpeed',
  'Harsh Acceleration',
  'Harsh Brake',
  'Forward Collision-A2',
  'Seatbelt-A2',
  'Camera Cover',
];

export const ALLOWED_REMARK_TARGETS = [
  'Fatigue',
  'Yawning',
  'Distraction',
  'Smoking',
  'Mobile Phone',
  'Eating/Drinking',
  'Seatbelt',
  'Camera Cover',
  'Harsh Brake',
  'Harsh Acceleration',
  'OverSpeed',
  'Forward Collision',
  'Maintenance',
  'Mirror Check',
  'Speed Meter Check',
];

export const withDerivedRemark = (alertType: string, remarks: string) => {
  const normalizedAlertType = normalizeLabel(alertType);
  const derivedRemarkByAlertType: Record<string, string> = {
    [normalizeLabel('Yawning-A2')]: 'Yawning',
    [normalizeLabel('OverSpeed')]: 'OverSpeed',
    [normalizeLabel('Harsh Acceleration')]: 'Harsh Acceleration',
    [normalizeLabel('Harsh Brake')]: 'Harsh Brake',
    [normalizeLabel('Forward Collision-A2')]: 'Forward Collision',
  };

  const derivedRemark = derivedRemarkByAlertType[normalizedAlertType];
  if (derivedRemark) {
    return derivedRemark;
  }

  // Eye Closing (A2) rows whose remark contains "Yawning" are counted as Yawning alerts
  if (
    normalizedAlertType === normalizeLabel('Eye Closing-A2') &&
    normalizeLabel(remarks).includes('yawning')
  ) {
    return 'Yawning';
  }

  return remarks;
};

export function resolveTemplate(template: string): string {
  if (template === 'Video') return 'Detail';
  return template;
}

export const buildTrendGeometry = (trendData: TrendDatum[], maxTrendValue: number): TrendGeometry => {
  const width = 1200;
  const height = 300;
  const padding = { top: 28, right: 32, bottom: 48, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  if (trendData.length === 0) {
    return { points: [], path: '', viewBox: `0 0 ${width} ${height}`, padding, width, height };
  }
  const maxValue = Math.max(1, maxTrendValue);
  const points = trendData.map((item, index) => {
    const x =
      trendData.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (trendData.length - 1)) * plotWidth;
    const y = padding.top + (1 - item.count / maxValue) * plotHeight;
    return { x, y, count: item.count, label: item.date.toLocaleDateString('en-GB') };
  });
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  return { points, path, viewBox: `0 0 ${width} ${height}`, padding, width, height };
};

export const buildYAxisTicks = (maxTrendValue: number, tickCount = 4) => {
  const maxValue = Math.max(1, maxTrendValue);
  return Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = Math.round((maxValue / tickCount) * (tickCount - index));
    return { value, position: index / tickCount };
  });
};

export const buildXAxisLabels = (trendData: TrendDatum[], maxLabels = 6): TrendLabel[] => {
  if (trendData.length === 0) return [];
  const labelCount = Math.min(maxLabels, trendData.length);
  return Array.from({ length: labelCount }, (_, index) => {
    const position = labelCount === 1 ? 0 : index / (labelCount - 1);
    const dataIndex = labelCount === 1 ? 0 : Math.round(position * (trendData.length - 1));
    const item = trendData[dataIndex];
    return {
      label: item.date.toLocaleDateString('en-GB'),
      position,
    };
  });
};

// Safety score computation
export const computeSafetyScore = (alertCount: number, vehicleCount: number, dayCount: number): number => {
  if (vehicleCount === 0 || dayCount === 0) return 100;
  const alertsPerVehiclePerDay = alertCount / vehicleCount / dayCount;
  const penalty = Math.min(70, alertsPerVehiclePerDay * 70);
  return Math.round(Math.max(0, 100 - penalty));
};

export const computeDriverSafetyScore = (alertCount: number, dayCount: number): number => {
  if (dayCount === 0) return 100;
  const alertsPerDay = alertCount / dayCount;
  const penalty = Math.min(70, alertsPerDay * 35);
  return Math.round(Math.max(0, 100 - penalty));
};

// CSV export helper
export const buildExportRows = (rows: Record<string, any>[], columns: string[]) => {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    columns.forEach((col) => {
      out[col] = findValue(row, [col]) ?? '';
    });
    return out;
  });
};
