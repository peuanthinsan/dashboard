export type DrivingThresholds = {
  /** Flag continuous driving when hours are strictly greater than this value. */
  continuousDrivingMaxHours: number;
  /** Flag rest when rest hours are strictly less than this (and rest &gt; 0). */
  restMinimumHours: number;
  /** Flag working hours when strictly greater than this (and working &gt; 0). */
  workingHoursMax: number;
};

export const DEFAULT_DRIVING_THRESHOLDS: DrivingThresholds = {
  continuousDrivingMaxHours: 9,
  restMinimumHours: 11,
  workingHoursMax: 10,
};

export function normalizeDrivingThresholds(raw: unknown): DrivingThresholds {
  const d = DEFAULT_DRIVING_THRESHOLDS;
  if (!raw || typeof raw !== 'object') {
    return { ...d };
  }
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    continuousDrivingMaxHours: num(o.continuousDrivingMaxHours, d.continuousDrivingMaxHours),
    restMinimumHours: num(o.restMinimumHours, d.restMinimumHours),
    workingHoursMax: num(o.workingHoursMax, d.workingHoursMax),
  };
}

export function parseDrivingThresholdsFromFormData(formData: FormData): DrivingThresholds {
  const read = (key: string, fallback: number) => {
    const raw = formData.get(key);
    const n = typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    continuousDrivingMaxHours: read('drivingContinuousMax', DEFAULT_DRIVING_THRESHOLDS.continuousDrivingMaxHours),
    restMinimumHours: read('drivingRestMin', DEFAULT_DRIVING_THRESHOLDS.restMinimumHours),
    workingHoursMax: read('drivingWorkingMax', DEFAULT_DRIVING_THRESHOLDS.workingHoursMax),
  };
}
