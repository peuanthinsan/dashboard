import { describe, expect, it } from 'vitest';
import { buildAfterHoursEntries, entryChartData, entryFleet, entryPresetRange, filterAfterHoursEntries, isEntryRange, parseAfterHoursSettingsFromFormData, parseEntryTime, reclassifyEntries, summarizeEntries, validateAfterHoursSettings, type AfterHoursSettings } from './afterHoursEntry';

const settings: AfterHoursSettings = { startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: ['Thongfleet'] };
const range = { from: '2026-10-01', to: '2026-10-05' };
const row = (time: string, vehicle = 'TRUCK-1') => ({ 'Vehicle No': vehicle, 'Alert Type': 'Unauthorised Entry', 'Alert Date Time': time,
  'User Name': 'THONGTRANSPORT MASTER,THONGTRANSPORT,SONGDEEAPI', 'Fleet': 'Thong', 'Driver Name': 'Demo Driver 1', 'Geofence Name': 'Customer Thongfleet area' });

describe('After-hours source dates and calendar filters', () => {
  it('reads displayed day/month order and returns a real Bangkok instant', () => {
    expect(parseEntryTime('01/10/2026 1:58:03')).toEqual({ day: '2026-10-01', seconds: 7083, timestamp: Date.parse('2026-10-01T01:58:03+07:00') });
  });
  it.each(['31/02/2026 8:00:00', '29/02/2026 8:00:00', '01/13/2026 8:00:00', '00/10/2026 8:00:00', '01/10/2026 24:00:00',
    '01/10/2026 8:60:00', '01/10/2026 8:00:60', '2026-10-01 08:00:00', 'Date(2026,0,10,8,0,0)', '', 46032])('rejects unreadable or rolled-over dates: %s', (value) => expect(parseEntryTime(value)).toBeNull());
  it('accepts leap day and rejects invalid range endpoints', () => {
    expect(parseEntryTime('29/02/2024 0:00:00')?.day).toBe('2024-02-29');
    expect(isEntryRange({ from: '2026-02-30', to: '2026-03-01' })).toBe(false);
    expect(isEntryRange({ from: '2026-10-05', to: '2026-10-01' })).toBe(false);
    expect(isEntryRange({ from: '2026-10-01', to: '2026-10-01' })).toBe(true);
  });
  it('uses Bangkok today across UTC midnight, Monday weeks and calendar months', () => {
    const now = new Date('2026-10-04T18:30:00Z'); // Monday 5 October locally
    expect(entryPresetRange('today', now)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(entryPresetRange('yesterday', now)).toEqual({ from: '2026-10-04', to: '2026-10-04' });
    expect(entryPresetRange('week', now)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(entryPresetRange('week', new Date('2026-10-04T08:00:00Z'))).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(entryPresetRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(entryPresetRange('yesterday', new Date('2026-01-01T00:00:00+07:00'))).toEqual({ from: '2025-12-31', to: '2025-12-31' });
  });
});

describe('Shared schedule and event classification', () => {
  it('includes exact opening/closing seconds and both full range endpoints', () => {
    const data = buildAfterHoursEntries(['01/10/2026 0:00:00', '01/10/2026 7:59:59', '01/10/2026 8:00:00', '01/10/2026 16:00:00',
      '01/10/2026 16:00:01', '05/10/2026 23:59:59', '06/10/2026 0:00:00'].map((time) => row(time)), settings, range, []);
    expect(data.entries.map((entry) => entry.status)).toEqual(['early', 'early', 'within', 'within', 'late', 'late']);
    expect(data.entries[1].differenceSeconds).toBe(1);
    expect(data.entries[4].differenceSeconds).toBe(1);
    expect(summarizeEntries(data.entries)).toEqual({ early: 2, within: 2, late: 2, outside: 4, vehicles: 1 });
  });
  it('keeps repeated entries, excludes unrelated events/areas/fleets, and counts invalid dates separately', () => {
    const good = row('01/10/2026 7:00:00');
    const data = buildAfterHoursEntries([good, { ...good, 'Alert Date Time': '01/10/2026 7:01:00' },
      { ...good, 'Alert Type': 'Overspeed' }, { ...good, 'Geofence Name': 'Depot' }, { ...good, 'Fleet': 'OTHER' },
      { ...good, 'Alert Date Time': '31/02/2026 7:00:00' }], settings, range, ['Thong']);
    expect(data.entries).toHaveLength(2);
    expect(data.invalidDates).toBe(1);
    expect(data.entries.every((entry) => entry.fleet === 'Thong' && entry.driver === 'Demo Driver 1')).toBe(true);
  });
  it('matches the Fleet value as a whole, ignoring case and outer whitespace', () => {
    expect(entryFleet(' thong ', ['Thong'])).toEqual({ included: true, label: 'thong' });
    expect(entryFleet('Thong2', ['Thong']).included).toBe(false);
    expect(entryFleet('Thong,Other', ['Thong']).included).toBe(false);
    expect(entryFleet('Thong', []).label).toBe('Thong');
    expect(entryFleet('', ['Thong']).included).toBe(false);
  });
  it('never falls back to User Name or Geofence Name for fleet; blank drivers remain visible', () => {
    const records = [{ ...row('01/10/2026 7:00:00'), 'Fleet': '', 'Driver Name': '' }];
    expect(buildAfterHoursEntries(records, settings, range, ['THONGTRANSPORT']).entries).toHaveLength(0);
    expect(buildAfterHoursEntries(records, settings, range, []).entries[0]).toMatchObject({ fleet: '—', driver: '—' });
  });
  it('combines multiple vehicle and fleet choices without double counting repeat entries', () => {
    const records = buildAfterHoursEntries([
      row('01/10/2026 7:00:00', 'A'), row('01/10/2026 8:00:00', 'A'),
      { ...row('01/10/2026 18:00:00', 'B'), Fleet: 'Other' },
      row('01/10/2026 9:00:00', 'C'),
    ], settings, range, []).entries;
    expect(filterAfterHoursEntries(records, [], [])).toHaveLength(4);
    expect(filterAfterHoursEntries(records, ['A', 'B'], ['Thong', 'Other'])).toHaveLength(3);
    expect(filterAfterHoursEntries(records, ['A', 'B'], ['Other']).map((entry) => entry.vehicle)).toEqual(['B']);
    expect(filterAfterHoursEntries(records, ['A'], ['Other'])).toHaveLength(0);
    expect(summarizeEntries(filterAfterHoursEntries(records, ['A', 'B'], []))).toEqual({ early: 1, late: 1, outside: 2, within: 1, vehicles: 2 });
  });
  it('recalculates demo status, differences, totals and charts from the same changed hours', () => {
    const records = buildAfterHoursEntries([row('01/10/2026 7:30:00'), row('01/10/2026 17:30:00')], settings, range, []).entries;
    const changed = reclassifyEntries(records, { startTime: '07:00', endTime: '18:00' });
    expect(changed.map((entry) => entry.differenceSeconds)).toEqual([0, 0]);
    expect(summarizeEntries(changed)).toEqual({ early: 0, late: 0, outside: 0, within: 2, vehicles: 0 });
    expect(entryChartData(changed, 'day')[0]).toMatchObject({ early: 0, within: 2, late: 0 });
    expect(records.map((entry) => entry.status)).toEqual(['early', 'late']);
  });
  it('reclassifies historical entries using an updated schedule', () => {
    const records = [row('02/10/2026 7:30:00')];
    expect(buildAfterHoursEntries(records, settings, range, []).entries[0].status).toBe('early');
    expect(buildAfterHoursEntries(records, { ...settings, startTime: '07:00' }, range, []).entries[0].status).toBe('within');
  });
  it('keeps chart totals consistent with events', () => {
    const records = buildAfterHoursEntries([row('01/10/2026 7:30:00'), row('01/10/2026 8:00:00'), row('02/10/2026 18:00:00')], settings, range, []).entries;
    const hourly = entryChartData(records, 'hour');
    expect(hourly).toHaveLength(24);
    expect(hourly[7].early).toBe(1);
    expect(entryChartData(records, 'day')).toEqual([{ key: '2026-10-01', early: 1, within: 1, late: 0 }, { key: '2026-10-02', early: 0, within: 0, late: 1 }]);
  });
  it('validates saved settings instead of silently defaulting a corrupt schedule', () => {
    for (const value of [null, {}, { ...settings, startTime: '8:00' }, { ...settings, endTime: '08:00' },
      { ...settings, startTime: '22:00' }, { ...settings, geofenceNames: [] }, { ...settings, timeZone: 'UTC' }]) {
      expect(() => validateAfterHoursSettings(value)).toThrow();
    }
    const form = new FormData();
    form.set('afterHoursStart', '09:00'); form.set('afterHoursEnd', '17:30'); form.set('afterHoursGeofences', 'Thongfleet\n thongfleet \nOther area');
    expect(parseAfterHoursSettingsFromFormData(form)).toEqual({ ...settings, startTime: '09:00', endTime: '17:30', geofenceNames: ['thongfleet', 'Other area'] });
  });
});
