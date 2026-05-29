import { z } from 'zod';

export type DrivingThresholdEntry =
  | number
  | { value: number; label?: string };

export type DrivingThresholds = {
  driveHours: DrivingThresholdEntry[];
  restHours: DrivingThresholdEntry[];
  cntDrvHours: DrivingThresholdEntry[];
};

export const DEFAULT_DRIVING_THRESHOLDS: DrivingThresholds = {
  driveHours: [10],
  restHours: [10],
  cntDrvHours: [4],
};

const MAX_ENTRIES_PER_METRIC = 5;
const MAX_LABEL_LEN = 32;

const ThresholdEntrySchema = z.union([
  z.number().positive().max(24),
  z.object({
    value: z.number().positive().max(24),
    label: z.string().max(MAX_LABEL_LEN).optional(),
  }),
]);

const ThresholdArraySchema = z
  .array(z.unknown())
  .transform((arr) =>
    arr
      .map((raw) => {
        const parsed = ThresholdEntrySchema.safeParse(raw);
        if (parsed.success) return parsed.data;
        if (raw && typeof raw === 'object' && 'value' in raw) {
          const v = (raw as { value: unknown }).value;
          const l = (raw as { label?: unknown }).label;
          const numericV = typeof v === 'number' ? v : Number(v);
          if (Number.isFinite(numericV) && numericV > 0 && numericV <= 24) {
            const label = typeof l === 'string' ? l.slice(0, MAX_LABEL_LEN) : undefined;
            return label ? { value: numericV, label } : { value: numericV };
          }
        }
        return null;
      })
      .filter((e): e is DrivingThresholdEntry => e !== null)
      .slice(0, MAX_ENTRIES_PER_METRIC),
  );

function isCntDrvLabel(entry: DrivingThresholdEntry): boolean {
  if (typeof entry === 'number') return false;
  const label = entry.label?.toLowerCase() ?? '';
  return label.includes('cnt drv') || label.includes('continuous');
}

function partitionDriveEntries(entries: DrivingThresholdEntry[]): {
  driveHours: DrivingThresholdEntry[];
  cntDrvHours: DrivingThresholdEntry[];
} {
  const driveHours: DrivingThresholdEntry[] = [];
  const cntDrvHours: DrivingThresholdEntry[] = [];
  for (const entry of entries) {
    if (isCntDrvLabel(entry)) cntDrvHours.push(entry);
    else driveHours.push(entry);
  }
  return { driveHours, cntDrvHours };
}

export function normalizeDrivingThresholds(raw: unknown): DrivingThresholds {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DRIVING_THRESHOLDS };
  const obj = raw as Record<string, unknown>;

  if ('continuousDrivingMaxHours' in obj || 'restMinimumHours' in obj || 'workingHoursMax' in obj) {
    const cntDrv = Number(obj.continuousDrivingMaxHours);
    const rest = Number(obj.restMinimumHours);
    const cntDrvHours: DrivingThresholdEntry[] = Number.isFinite(cntDrv) && cntDrv > 0
      ? [{ value: cntDrv, label: `Cnt Drv > ${cntDrv} h` }]
      : [...DEFAULT_DRIVING_THRESHOLDS.cntDrvHours];
    const restHours: DrivingThresholdEntry[] = Number.isFinite(rest) && rest > 0
      ? [rest]
      : [...DEFAULT_DRIVING_THRESHOLDS.restHours];
    return {
      driveHours: [...DEFAULT_DRIVING_THRESHOLDS.driveHours],
      restHours,
      cntDrvHours,
    };
  }

  const driveHoursRaw = Array.isArray(obj.driveHours) ? obj.driveHours : [];
  const restHoursRaw = Array.isArray(obj.restHours) ? obj.restHours : [];
  const cntDrvHoursRaw = Array.isArray(obj.cntDrvHours) ? obj.cntDrvHours : [];

  const partitioned = partitionDriveEntries(ThresholdArraySchema.parse(driveHoursRaw));
  const driveHours = partitioned.driveHours;
  const cntDrvFromDrive = partitioned.cntDrvHours;
  const restHours = ThresholdArraySchema.parse(restHoursRaw);
  const cntDrvHoursExplicit = ThresholdArraySchema.parse(cntDrvHoursRaw);
  const cntDrvHours = [...cntDrvFromDrive, ...cntDrvHoursExplicit];

  return {
    driveHours: driveHours.length > 0 ? driveHours : [...DEFAULT_DRIVING_THRESHOLDS.driveHours],
    restHours: restHours.length > 0 ? restHours : [...DEFAULT_DRIVING_THRESHOLDS.restHours],
    cntDrvHours: cntDrvHours.length > 0 ? cntDrvHours : [...DEFAULT_DRIVING_THRESHOLDS.cntDrvHours],
  };
}

export function thresholdEntryValue(e: DrivingThresholdEntry): number {
  return typeof e === 'number' ? e : e.value;
}

export function thresholdEntryLabel(e: DrivingThresholdEntry, fallback: string): string {
  if (typeof e === 'object' && e.label) return e.label;
  return fallback;
}

export function parseDrivingThresholdsFromFormData(fd: FormData): DrivingThresholds {
  const raw = fd.get('drivingThresholdsJson');
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ...DEFAULT_DRIVING_THRESHOLDS };
  }
  try {
    return normalizeDrivingThresholds(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DRIVING_THRESHOLDS };
  }
}
