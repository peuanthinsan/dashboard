import { describe, expect, it } from 'vitest';
import { buildVinythaiAlerts, filterVinythaiAlerts, summarizeVinythaiAlerts } from './vinythaiSummaryData';
import type { GoogleSheetRow } from './googleSheetParse';

const row = (overrides: GoogleSheetRow = {}): GoogleSheetRow => ({
  id: '1', 'Vehicle No': 'FLEET-001', Fleet: 'Fusion Vinythai', User: 'SONGDEEAPI,Fusion,Vinythaiall',
  'Alert Type': 'Eye Closing-A2', Remarks: 'Mobile Phone', 'Alert Date Time': '2026-06-01 2:36:33',
  'Track Time': '2026-06-01 2:36:33', Speed: 40, ...overrides,
});
const all = { month: 'all', customer: 'all', type: 'all', hiddenCustomers: [] };

describe('Vinythai summary', () => {
  it('requires roster-derived Fleet and a plate before building all report domains', () => {
    const alerts = buildVinythaiAlerts([row(), row({ id: '2', Fleet: '', User: 'Fusion' }), row({ id: '3', 'Vehicle No': '' })]);
    expect(alerts).toHaveLength(1);
    expect(summarizeVinythaiAlerts(alerts).customers).toEqual([{ label: 'Fusion Vinythai', count: 1 }]);
  });
  it('enforces exact configured fleet membership regardless of misleading User tokens', () => {
    const alerts = buildVinythaiAlerts([row(), row({ id: '2', Fleet: 'FNP Vinythai' })], { organizationNames: [' fnp vinythai '] });
    expect(alerts.map((a) => a.fleet)).toEqual(['FNP Vinythai']);
  });
  it('removes only exact duplicates and keeps different source events sharing an ID', () => {
    const alerts = buildVinythaiAlerts([row(), row(), row({ videoURL: 'different-evidence' }), row({ id: '2' })]);
    expect(alerts).toHaveLength(3);
  });
  it('uses Track Time when Alert Date Time is blank and keeps Bangkok single-digit hours', () => {
    const alerts = buildVinythaiAlerts([row({ 'Alert Date Time': '', 'Track Time': '2026-07-05 3:07:01' }), row({ id: '2' })]);
    expect(alerts[0]!.date.toISOString()).toBe('2026-07-05T03:07:01.000Z');
    expect(alerts[1]!.date.toISOString()).toBe('2026-06-01T02:36:33.000Z');
    expect(summarizeVinythaiAlerts(alerts).hours[3]!.count).toBe(1);
  });
  it('applies existing false-alert exclusions and configured type/remark rules', () => {
    const alerts = buildVinythaiAlerts([row(), row({ id: '2', Remarks: 'False alert' }), row({ id: '3', Remarks: 'No video' }), row({ id: '4', 'Alert Type': 'OverSpeed', Remarks: '' })], { allowedAlertTypes: ['Eye Closing-A2'], allowedRemarks: ['Mobile Phone'] });
    expect(alerts).toHaveLength(1);
    expect(buildVinythaiAlerts([row()], { alertRules: [{ id: 'exclude', type: 'always_exclude', alertType: 'Eye Closing-A2' }] })).toHaveLength(0);
  });
  it('keeps KPIs, customer/vehicle rankings, months and hours reconciled with active filters', () => {
    const alerts = buildVinythaiAlerts([
      row({ Speed: 0 }), row({ id: '2', Speed: '', 'Vehicle No': 'FLEET-002' }),
      row({ id: '3', Speed: 60, Fleet: 'FNP Vinythai', 'Alert Date Time': '2026-07-01 5:00:00' }),
      row({ id: '4', Speed: 80, 'Alert Type': 'OverSpeed', Remarks: 'Overspeed' }),
    ]);
    const filtered = filterVinythaiAlerts(alerts, { ...all, type: 'remark:mobile phone', month: '2026-06' });
    const summary = summarizeVinythaiAlerts(filtered);
    expect(summary.total).toBe(2);
    expect(summary.vehicleCount).toBe(2);
    expect(summary.averageSpeed).toBe(0); // blank is missing; measured zero is real
    expect(summary.customers.reduce((sum, c) => sum + c.count, 0)).toBe(summary.total);
    expect(summary.hours.reduce((sum, h) => sum + h.count, 0)).toBe(summary.total);
    expect(filterVinythaiAlerts(alerts, { ...all, hiddenCustomers: ['Fusion Vinythai'] })).toHaveLength(1);
    expect(filterVinythaiAlerts(alerts, { ...all, customer: 'FNP Vinythai' })).toHaveLength(1);
  });
  it('returns missing speed and empty top vehicle as unavailable instead of healthy zeros', () => {
    expect(summarizeVinythaiAlerts([])).toMatchObject({ total: 0, vehicleCount: 0, topVehicle: null, averageSpeed: null });
    expect(summarizeVinythaiAlerts(buildVinythaiAlerts([row({ Speed: 'unknown' })])).averageSpeed).toBeNull();
  });
  it('does not turn an unclassified blank remark into a fatigue diagnosis', () => {
    expect(buildVinythaiAlerts([row({ 'Alert Type': 'Panic', Remarks: '' })])[0]!.remark).toBe('—');
  });
  it('preserves raw false/no-video exclusions even when default rules remap the alert type', () => {
    expect(buildVinythaiAlerts([
      row({ 'Alert Type': 'OverSpeed', Remarks: 'False alert' }),
      row({ id: '2', 'Alert Type': 'Yawning-A2', Remarks: 'No video' }),
    ])).toEqual([]);
  });
});
