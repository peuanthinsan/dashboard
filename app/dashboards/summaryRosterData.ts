import { rosterKey, type DriverRosterEntry } from './driverRoster';
import { computeSafetyScore } from './dashboardDataUtils';

export const SUMMARY_ALERT_COLUMNS = [
  { key: 'Distraction', label: 'Distraction' },
  { key: 'Harsh Acceleration', label: 'Harsh Acceleration' },
  { key: 'Harsh Brake', label: 'Harsh Brake' },
  { key: 'Overspeed', label: 'OverSpeed' },
  { key: 'Yawning', label: 'Yawning' },
  { key: 'Fatigue', label: 'Fatigue' },
  { key: 'Mobile Phone', label: 'Mobile Phone' },
  { key: 'Eating/Drinking', label: 'Eating/Drinking' },
  { key: 'Smoking', label: 'Smoking' },
  { key: 'Other', label: 'Other' },
];
export type SummaryAlertRow = { vehicle: string; driver: string; fleet: string; remarks: string };
export type SummaryCountRow = DriverRosterEntry & { counts: Record<string, number>; total: number; inRoster: boolean };
const pairKey = (entry: DriverRosterEntry) => [entry.fleet, entry.vehicle, entry.driver].map(rosterKey).join('\0');
const categoryKey = (value: string) => rosterKey(value).replace(/[\s-]+/g, '');
export function getSummaryAlertCategory(remark: string) {
  return SUMMARY_ALERT_COLUMNS.find((column) => column.key !== 'Other' && categoryKey(remark).includes(categoryKey(column.key)))?.key ?? 'Other';
}
export function matchesSummaryAlert(remark: string, target: string) {
  const standard = SUMMARY_ALERT_COLUMNS.find((column) => categoryKey(column.key) === categoryKey(target));
  return standard ? getSummaryAlertCategory(remark) === standard.key : categoryKey(remark).includes(categoryKey(target));
}
export function computeSummarySafetyScore(alertCount: number, observedVehicles: number, observedDays: number, rosterEnabled: boolean) {
  if (rosterEnabled && alertCount === 0) return null;
  return computeSafetyScore(alertCount, Math.max(1, observedVehicles), Math.max(1, observedDays));
}
export function buildSummaryRosterData(alerts: SummaryAlertRow[], roster: DriverRosterEntry[] = [], rosterEnabled = false) {
  const grouped = new Map<string, SummaryCountRow>();
  for (const entry of roster) grouped.set(pairKey(entry), { ...entry, counts: {}, total: 0, inRoster: true });
  for (const alert of alerts) {
    const entry = { vehicle: alert.vehicle === '—' ? 'Unspecified' : alert.vehicle,
      driver: alert.driver === '—' ? 'Unspecified' : alert.driver, fleet: alert.fleet };
    const key = pairKey(entry);
    const row = grouped.get(key) ?? { ...entry, counts: {}, total: 0, inRoster: false };
    const category = getSummaryAlertCategory(alert.remarks);
    row.counts[category] = (row.counts[category] ?? 0) + 1;
    row.total += 1;
    grouped.set(key, row);
  }
  const data = [...grouped.values()].sort((a, b) => b.total - a.total || a.vehicle.localeCompare(b.vehicle, undefined, { numeric: true }) || a.driver.localeCompare(b.driver));
  const columns = SUMMARY_ALERT_COLUMNS.filter((column, index) => column.key === 'Overspeed' || (rosterEnabled && index < 5) || data.some((row) => row.counts[column.key] > 0));
  const drivers = new Map<string, { driver: string; total: number; inRoster: boolean }>();
  for (const row of data) {
    if (row.driver === 'Unspecified') continue;
    const key = rosterKey(row.driver);
    const existing = drivers.get(key) ?? { driver: row.driver, total: 0, inRoster: false };
    existing.total += row.total;
    existing.inRoster ||= row.inRoster;
    drivers.set(key, existing);
  }
  const driverList = [...drivers.values()];
  return { data, columns, maxCount: Math.max(1, ...data.flatMap((row) => Object.values(row.counts))),
    totalAlerts: alerts.length, totalDrivers: driverList.length,
    rosterDrivers: driverList.filter((driver) => driver.inRoster).length,
    driversWithAlerts: driverList.filter((driver) => driver.total > 0).length,
    driversWithoutAlerts: driverList.filter((driver) => driver.total === 0).length,
    totalVehicles: new Set(data.filter((row) => row.vehicle !== 'Unspecified').map((row) => rosterKey(row.vehicle))).size,
    overspeed: data.reduce((sum, row) => sum + (row.counts.Overspeed ?? 0), 0) };
}
