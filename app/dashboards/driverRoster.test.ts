import { describe, expect, it } from 'vitest';
import { filterDriverRoster, indexDriverRoster, mapRosterDriver, parseDriverRoster, parseDriverRosterForm, validateDriverRosterSettings } from './driverRoster';
import { parseGoogleSheetTable } from './googleSheetParse';
import { buildSummaryRosterData, computeSummarySafetyScore, matchesSummaryAlert } from './summaryRosterData';

const roster = [
  { vehicle: '1001', driver: 'Driver A', fleet: 'SERVICE' },
  { vehicle: '1002', driver: 'Driver B', fleet: 'SERVICE' },
  { vehicle: '1003', driver: 'Driver C', fleet: 'SERVICE' },
];
const alert = (index = 0, remarks = 'Distraction') => ({ ...roster[index], remarks });
const source = (headers: string[], rows: unknown[][]) => parseGoogleSheetTable({ table: {
  cols: headers.map((label) => ({ label })), rows: rows.map((cells) => ({ c: cells.map((v) => ({ v })) })),
} });

describe('complete driver roster', () => {
  it('does not invent safety scores from roster membership and preserves observed-alert scores', () => {
    expect(computeSummarySafetyScore(0, 0, 1, true)).toBeNull();
    expect(computeSummarySafetyScore(0, 15, 30, true)).toBeNull();
    expect(computeSummarySafetyScore(29, 7, 18, true)).toBe(computeSummarySafetyScore(29, 7, 18, false));
  });
  it('uses the same overspeed classification for highlights and table counts', () => {
    const alerts = ['OverSpeed', 'Over speed', 'Over-speed', 'OVER SPEED'].map((remark) => alert(0, remark));
    const highlightCount = alerts.filter((row) => matchesSummaryAlert(row.remarks, 'Overspeed')).length;
    expect(highlightCount).toBe(4);
    expect(buildSummaryRosterData(alerts, roster, true).overspeed).toBe(highlightCount);
    expect(matchesSummaryAlert('Distraction', 'Overspeed')).toBe(false);
  });
  it('reads the provided header spelling, numeric vehicles and removes identical duplicates', () => {
    const sheet = source([' Vehicel No.', 'Name.'], [[1001, ' Driver A '], [1001, 'driver a'], [null, null]]);
    expect(parseDriverRoster(sheet.columns, sheet.rows, 'SERVICE')).toEqual([roster[0]]);
  });
  it('fails visibly for wrong tabs, incomplete assignments, conflicting names or unresolved fleet', () => {
    for (const data of [source(['id', 'Alert Type'], [[1, 'Distraction']]),
      source(['Vehicle No', 'Driver Name'], [[1001, '']]),
      source(['Vehicle No', 'Driver Name'], [[1001, 'A'], [1001, 'B']])]) {
      expect(() => parseDriverRoster(data.columns, data.rows, 'SERVICE')).toThrow();
    }
    const data = source(['Vehicle No', 'Driver Name'], [[1001, 'A']]);
    expect(() => parseDriverRoster(data.columns, data.rows, '')).toThrow(/Fleet/);
  });
  it('honors an explicit per-row fleet and only joins within the same fleet', () => {
    const sheet = source(['Vehicle No', 'Driver Name', 'Fleet'], [[1001, 'Other Driver', 'OTHER']]);
    const other = parseDriverRoster(sheet.columns, sheet.rows, 'SERVICE');
    expect(mapRosterDriver(alert(), indexDriverRoster(other), 'vehicle').driver).toBe('Driver A');
  });
  it('maps roster names by exact vehicle; preserves source names under recorded policy', () => {
    const original = { ...alert(), driver: 'Old Driver' };
    expect(mapRosterDriver(original, indexDriverRoster(roster), 'vehicle').driver).toBe('Driver A');
    expect(mapRosterDriver(original, indexDriverRoster(roster), 'recorded').driver).toBe('Old Driver');
    expect(original.driver).toBe('Old Driver');
    expect(mapRosterDriver({ ...original, driver: '—' }, indexDriverRoster(roster), 'recorded').driver).toBe('Driver A');
    expect(mapRosterDriver({ ...original, vehicle: 'prefix1001' }, indexDriverRoster(roster), 'vehicle').driver).toBe('Old Driver');
  });
  it('keeps every roster driver during zero-alert periods and always displays OverSpeed', () => {
    const model = buildSummaryRosterData([], roster, true);
    expect(model).toMatchObject({ totalDrivers: 3, totalVehicles: 3, driversWithAlerts: 0, driversWithoutAlerts: 3, overspeed: 0 });
    expect(model.data.every((row) => row.total === 0)).toBe(true);
    expect(model.columns.some((column) => column.label === 'OverSpeed')).toBe(true);
    expect(buildSummaryRosterData([]).columns.some((column) => column.label === 'OverSpeed')).toBe(true);
  });
  it('keeps alerts outside the roster, normalizes case, and reconciles Other with totals', () => {
    const alerts = [alert(), { ...alert(), driver: ' driver a ', vehicle: '1001' }, alert(0, 'Unclassified event'),
      { vehicle: '9999', driver: 'Guest', fleet: 'SERVICE', remarks: 'Over speed' }];
    const model = buildSummaryRosterData(alerts, roster, true);
    expect(model).toMatchObject({ totalDrivers: 4, driversWithAlerts: 2, driversWithoutAlerts: 2, totalAlerts: 4, overspeed: 1 });
    expect(model.data.find((row) => row.driver === 'Driver A')).toMatchObject({ total: 3, counts: { Distraction: 2, Other: 1 } });
    expect(model.data.reduce((sum, row) => sum + Object.values(row.counts).reduce((a, b) => a + b, 0), 0)).toBe(4);
  });
  it('filters roster-only drivers by fleet, vehicle and name, without needing an event', () => {
    expect(filterDriverRoster(roster, { fleets: [' service '], vehicles: ['1003'], drivers: ['driver c'] })).toEqual([roster[2]]);
    expect(filterDriverRoster(roster, { fleets: ['OTHER'] })).toEqual([]);
  });
  it('counts a driver assigned to two vehicles once and does not mark them as zero-alert', () => {
    const multiple = [roster[0], { ...roster[0], vehicle: '1004' }];
    const model = buildSummaryRosterData([alert()], multiple, true);
    expect(model).toMatchObject({ totalDrivers: 1, totalVehicles: 2, driversWithAlerts: 1, driversWithoutAlerts: 0 });
  });
  it('requires a verified tab link and validates server-side configuration', () => {
    const form = new FormData();
    expect(parseDriverRosterForm(form)).toBeNull();
    form.set('driverRosterUrl', 'https://docs.google.com/spreadsheets/d/abcdefghijk/edit');
    expect(() => parseDriverRosterForm(form)).toThrow(/gid/);
    form.set('driverRosterUrl', 'https://docs.google.com/spreadsheets/d/abcdefghijk/edit#gid=123');
    form.set('driverRosterFleet', 'SERVICE');
    expect(parseDriverRosterForm(form)).toEqual({ sheetId: 'abcdefghijk', sheetGid: '123', defaultFleet: 'SERVICE', namePolicy: 'recorded' });
    expect(() => validateDriverRosterSettings({ ...parseDriverRosterForm(form), sheetId: '../other' })).toThrow();
    form.set('driverRosterUrl', 'https://attacker.test/spreadsheets/d/abcdefghijk/edit#gid=123');
    expect(() => parseDriverRosterForm(form)).toThrow();
  });
});
