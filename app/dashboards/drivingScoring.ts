import { bucketByDriverDay, type DriverDay } from './driverDayBucketing';
import { type DrivingThresholds, thresholdEntryValue } from './drivingThresholds';

export const METRIC_WEIGHTS = { driveHours: 1.2, restHours: 1.5 } as const;
export const SEVERITY_PENALTY_PER_DAY_MULTIPLIER = 25;

export type DrivingGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type DriverDaySeverity = { drive: 0 | 1 | 3; rest: 0 | 1 | 3 };

function bandValue(thresholds: number[], value: number, direction: '>' | '<'): 0 | 1 | 3 {
  if (thresholds.length === 0) return 0;
  const sorted = [...thresholds].sort((a, b) => a - b);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  if (direction === '>') {
    if (value <= lowest) return 0;
    if (value > highest) return 3;
    return 1;
  }
  if (value >= highest) return 0;
  if (value < lowest) return 3;
  return 1;
}

export function severityForDriverDay(day: DriverDay, thresholds: DrivingThresholds): DriverDaySeverity {
  const driveThresholds = thresholds.driveHours.map(thresholdEntryValue);
  const restThresholds = thresholds.restHours.map(thresholdEntryValue);
  const drive = bandValue(driveThresholds, day.totalDriveHours, '>');

  const positiveRests = day.shifts.map((s) => s.restHours).filter((r) => r > 0);
  let rest: 0 | 1 | 3;
  if (positiveRests.length === 0 || restThresholds.length === 0) {
    rest = 0;
  } else {
    const worst = Math.min(...positiveRests);
    rest = bandValue(restThresholds, worst, '<');
  }

  return { drive, rest };
}

export function computeDrivingScore(
  rows: Parameters<typeof bucketByDriverDay>[0],
  thresholds: DrivingThresholds,
) {
  const days = bucketByDriverDay(rows);
  if (days.length === 0) {
    return { score: 100, grade: 'A' as DrivingGrade, perMetric: { drive: 0, rest: 0 }, totalDays: 0 };
  }
  let weighted = 0;
  let drivePenalty = 0;
  let restPenalty = 0;
  for (const d of days) {
    const s = severityForDriverDay(d, thresholds);
    weighted += s.drive * METRIC_WEIGHTS.driveHours + s.rest * METRIC_WEIGHTS.restHours;
    drivePenalty += s.drive;
    restPenalty += s.rest;
  }
  const perDay = weighted / days.length;
  const raw = 100 - perDay * SEVERITY_PENALTY_PER_DAY_MULTIPLIER;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  return {
    score,
    grade: gradeFromScore(score),
    perMetric: { drive: drivePenalty, rest: restPenalty },
    totalDays: days.length,
  };
}

export function gradeFromScore(score: number): DrivingGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
