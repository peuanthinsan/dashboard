import { normalizeLabel } from './dashboardDataUtils';
import { parseDurationHours } from './drivingSheetRows';

const DURATION_LABELS = new Set([
  'drivehrs',
  'drivehrs duration',
  'rest time',
  'rest hr',
  'resthr',
  'rest hour',
  'rest hours',
  'rest duration',
  'resthrs',
  'resthrs duration',
  'working hr',
  'working hour',
  'working hours',
  'work hr',
  'work hour',
  'work hours',
  'working time',
  'work time',
  'total working',
  'workhrs',
  'workhrs duration',
  'cnt drv hr',
  'cnt drv hrs',
  'cnt drv hours',
  'cnt drv duration',
  'cnt drv',
  'cntdrv hr',
  'cntdrv hrs',
  'cnt.drv hr',
  'cnt. drv hr',
  'continuous drv hr',
  'continuous drv hrs',
  'continuous driving hr',
  'continuous driving hrs',
  'cont drv hr',
  'cont drv hrs',
]);

export function isDurationColumnLabel(label: string): boolean {
  return DURATION_LABELS.has(normalizeLabel(label));
}

/** Normalize "H:MM", "HH:MM:SS", etc. to H:MM:SS for display. */
export function normalizeHmsDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes(':')) return trimmed;
  const parts = trimmed.split(':').map((part) => part.trim());
  if (parts.some((part) => part === '' || Number.isNaN(Number(part)))) return trimmed;
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (parts.length === 2) {
    const [m, s] = parts.map(Number);
    return `${m}:${String(s).padStart(2, '0')}:00`;
  }
  return trimmed;
}

export function hoursToHms(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0:00:00';
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDurationDisplay(value: unknown, hoursFallback?: number): string {
  if (value != null && value !== '') {
    const raw = String(value).trim();
    if (raw.includes(':')) return normalizeHmsDisplay(raw);
    const parsed = parseDurationHours(raw);
    if (parsed > 0) return hoursToHms(parsed);
    if (raw !== '0' && raw !== '0.0') return raw;
  }
  if (hoursFallback != null && Number.isFinite(hoursFallback) && hoursFallback > 0) {
    return hoursToHms(hoursFallback);
  }
  return '—';
}
