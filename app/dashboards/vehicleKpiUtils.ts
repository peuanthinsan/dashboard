import { isExcludedAlertRemark, normalizeLabel } from './dashboardDataUtils';

export type VehicleKpiCategoryKey = 'speeding' | 'seatbelt' | 'harsh' | 'phone' | 'forward';

export type VehicleKpiGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export const VEHICLE_KPI_CATEGORIES: ReadonlyArray<{
  key: VehicleKpiCategoryKey;
  label: string;
  alertTypes?: string[];
  remarks?: string[];
}> = [
  { key: 'speeding', label: 'Speeding', alertTypes: ['OverSpeed'] },
  {
    key: 'seatbelt',
    label: 'Seat belt',
    alertTypes: ['No Seatbelt', 'No Seat belt', 'Seatbelt', 'Seat Belt'],
  },
  {
    key: 'harsh',
    label: 'Harsh braking/accel',
    alertTypes: ['Harsh Brake', 'Harsh Acceleration'],
  },
  { key: 'phone', label: 'Phone call', remarks: ['Mobile Phone'] },
  { key: 'forward', label: 'Forward collision', alertTypes: ['Forward Collision-A2'] },
];

export const GRADE_COLORS: Record<VehicleKpiGrade, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

/** Converts an incident count into the DHL A–F safety band. */
export function gradeForCount(n: number): VehicleKpiGrade {
  if (n <= 0) return 'A';
  if (n <= 5) return 'B';
  if (n <= 10) return 'C';
  if (n <= 20) return 'D';
  return 'F';
}

/** Assigns one raw alert row to at most one VehicleKPI category. */
export function categorizeRow(
  alertType: string | null,
  remark: string | null,
): VehicleKpiCategoryKey | null {
  const rawRemark = remark ?? '';
  if (isExcludedAlertRemark(rawRemark)) return null;

  const normalizedAlertType = normalizeLabel(alertType ?? '');
  for (const category of VEHICLE_KPI_CATEGORIES) {
    if (
      category.alertTypes?.some(
        (candidate) => normalizeLabel(candidate) === normalizedAlertType,
      )
    ) {
      return category.key;
    }
  }

  const normalizedRemark = normalizeLabel(rawRemark);
  for (const category of VEHICLE_KPI_CATEGORIES) {
    if (
      category.remarks?.some(
        (candidate) => normalizeLabel(candidate) === normalizedRemark,
      )
    ) {
      return category.key;
    }
  }

  return null;
}

export type VehicleKpiCounts = Record<VehicleKpiCategoryKey, number>;

export type VehicleKpiRow = {
  vehicle: string;
  fleet: string;
  counts: VehicleKpiCounts;
};

export type VehicleKpiInputRow = {
  vehicle: string;
  fleet: string;
  alertType: string | null;
  remark: string | null;
};

export type VehicleKpiFleetRow = {
  fleet: string;
  counts: VehicleKpiCounts;
};

/** Creates a fresh five-category counter so absent KPIs remain explicit zeroes. */
export function emptyVehicleKpiCounts(): VehicleKpiCounts {
  return {
    speeding: 0,
    seatbelt: 0,
    harsh: 0,
    phone: 0,
    forward: 0,
  };
}

/** Aggregates filtered alert rows by normalized vehicle while preserving display labels. */
export function aggregateVehicleKpi(rows: VehicleKpiInputRow[]): Map<string, VehicleKpiRow> {
  const vehicles = new Map<string, VehicleKpiRow>();

  for (const row of rows) {
    const vehicle = row.vehicle.trim();
    const vehicleKey = normalizeLabel(vehicle);
    if (!vehicleKey) continue;

    const fleet = row.fleet.trim();
    const existing = vehicles.get(vehicleKey);
    const aggregate = existing ?? {
      vehicle,
      fleet,
      counts: emptyVehicleKpiCounts(),
    };

    if (!aggregate.fleet && fleet) aggregate.fleet = fleet;

    const category = categorizeRow(row.alertType, row.remark);
    if (category) aggregate.counts[category] += 1;

    if (!existing) vehicles.set(vehicleKey, aggregate);
  }

  return vehicles;
}

/** Sums per-vehicle KPI counts into one row per normalized fleet. */
export function rollupByFleet(rows: VehicleKpiRow[]): VehicleKpiFleetRow[] {
  const fleets = new Map<string, VehicleKpiFleetRow>();

  for (const row of rows) {
    const fleet = row.fleet.trim() || '—';
    const fleetKey = normalizeLabel(fleet);
    const aggregate = fleets.get(fleetKey) ?? {
      fleet,
      counts: emptyVehicleKpiCounts(),
    };

    for (const category of VEHICLE_KPI_CATEGORIES) {
      aggregate.counts[category.key] += row.counts[category.key];
    }

    if (!fleets.has(fleetKey)) fleets.set(fleetKey, aggregate);
  }

  return Array.from(fleets.values()).sort((a, b) =>
    a.fleet.localeCompare(b.fleet, undefined, { numeric: true }),
  );
}
