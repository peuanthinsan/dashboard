import {
  ALERT_TIME_ALIASES, applyAlertRules, findValue, isExcludedAlertRemark,
  normalizeLabel, parseDate, remarkMatchesAllowedTarget, scopeFleetSet, toMonthKey,
  type AlertRule,
} from './dashboardDataUtils';
import type { GoogleSheetRow } from './googleSheetParse';

export type VinythaiAlert = {
  key: string;
  vehicle: string;
  fleet: string;
  alertType: string;
  remark: string;
  date: Date;
  month: string;
  speed: number | null;
  driver: string;
  location: string;
};

type AlertPolicy = {
  organizationName?: string | null;
  organizationNames?: string[] | null;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  alertRules?: AlertRule[] | null;
};

const text = (value: unknown) => value == null ? '' : String(value).trim();
const missing = (value: string) => !value || value === '—' || value === '-';

/** Sheet1.Fleet is its exact Vehicle No → Fleet!A:B roster lookup, not User. */
export function buildVinythaiAlerts(rows: GoogleSheetRow[], policy: AlertPolicy = {}): VinythaiAlert[] {
  const scope = scopeFleetSet(policy.organizationName, policy.organizationNames);
  const allowedTypes = new Set(policy.allowedAlertTypes?.map(normalizeLabel));
  const allowedRemarks = policy.allowedRemarks?.map(normalizeLabel) ?? [];
  const seen = new Set<string>();
  const fleetLabels = new Map<string, string>();
  const alerts: VinythaiAlert[] = [];
  for (const row of rows) {
    const fleet = text(findValue(row, ['Fleet']));
    const vehicle = text(findValue(row, ['Vehicle No', 'Vehicle No TH', 'Plate']));
    if (missing(fleet) || missing(vehicle) || (scope.size > 0 && !scope.has(normalizeLabel(fleet)))) continue;
    const alertType = text(findValue(row, ['Alert Type']));
    if (missing(alertType) || (allowedTypes.size > 0 && !allowedTypes.has(normalizeLabel(alertType)))) continue;
    // A blank Alert Date Time must not suppress a valid Track Time.
    let date: Date | null = null;
    for (const alias of ALERT_TIME_ALIASES) {
      date = parseDate(findValue(row, [alias]));
      if (date) break;
    }
    if (!date) continue;
    const speedText = text(findValue(row, ['Speed', 'Max Speed']));
    const numericSpeed = Number(speedText.replace(/,/g, ''));
    const speed = speedText && Number.isFinite(numericSpeed) && numericSpeed >= 0 ? numericSpeed : null;
    const rawRemark = text(findValue(row, ['Remarks'])) || '—';
    if (isExcludedAlertRemark(rawRemark)) continue;
    const remark = applyAlertRules(alertType, rawRemark, speed ?? 0, policy.alertRules ?? []);
    if (isExcludedAlertRemark(remark)) continue;
    if (allowedRemarks.length > 0 && !allowedRemarks.some((target) => remarkMatchesAllowedTarget(normalizeLabel(remark), target))) continue;
    // IDs repeat in the source. Remove identical source records, retaining
    // different records even when they share an ID. Never dedupe by ID alone.
    const key = JSON.stringify(Object.keys(row).sort().map((field) => [field, row[field]]));
    if (seen.has(key)) continue;
    seen.add(key);
    const fleetKey = normalizeLabel(fleet);
    if (!fleetLabels.has(fleetKey)) fleetLabels.set(fleetKey, fleet);
    alerts.push({
      key, vehicle, fleet: fleetLabels.get(fleetKey)!, alertType, remark, date,
      month: toMonthKey(date), speed,
      driver: text(findValue(row, ['Driver Name'])),
      location: text(findValue(row, ['Location', 'Address', 'Landmark'])),
    });
  }
  return alerts.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export type VinythaiFilters = { month: string; customer: string; type: string; hiddenCustomers: string[] };

export function filterVinythaiAlerts(alerts: VinythaiAlert[], filters: VinythaiFilters): VinythaiAlert[] {
  const hidden = new Set(filters.hiddenCustomers.map(normalizeLabel));
  return alerts.filter((alert) =>
    (filters.month === 'all' || alert.month === filters.month) &&
    (filters.customer === 'all' || normalizeLabel(alert.fleet) === normalizeLabel(filters.customer)) &&
    !hidden.has(normalizeLabel(alert.fleet)) &&
    (filters.type === 'all' || (filters.type === 'remark:mobile phone'
      ? normalizeLabel(alert.remark).includes('mobile phone') || normalizeLabel(alert.alertType) === 'phone call-a2'
      : normalizeLabel(alert.alertType) === normalizeLabel(filters.type)))
  );
}

export function summarizeVinythaiAlerts(alerts: VinythaiAlert[]) {
  const customers = new Map<string, number>();
  const vehicles = new Map<string, number>();
  const months = new Map<string, Map<string, number>>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  let speedSum = 0;
  let speedCount = 0;
  for (const alert of alerts) {
    customers.set(alert.fleet, (customers.get(alert.fleet) ?? 0) + 1);
    vehicles.set(alert.vehicle, (vehicles.get(alert.vehicle) ?? 0) + 1);
    const monthly = months.get(alert.month) ?? new Map<string, number>();
    monthly.set(alert.fleet, (monthly.get(alert.fleet) ?? 0) + 1);
    months.set(alert.month, monthly);
    hours[alert.date.getUTCHours()]!.count++;
    if (alert.speed !== null) { speedSum += alert.speed; speedCount++; }
  }
  const rank = (counts: Map<string, number>) => Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const vehicleRanking = rank(vehicles);
  return {
    total: alerts.length, vehicleCount: vehicles.size,
    topVehicle: vehicleRanking[0] ?? null,
    averageSpeed: speedCount > 0 ? speedSum / speedCount : null,
    customers: rank(customers), vehicles: vehicleRanking, months, hours,
  };
}
