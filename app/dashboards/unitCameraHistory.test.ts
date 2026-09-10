import { describe, expect, it } from 'vitest';
import { buildUnitMonitorRows, buildUnitRows, getUnitMonitorDamage, mergeUnitCameraHistory, type UnitCameraHistory } from './unitStatusData';
import type { GoogleSheetRow } from './googleSheetParse';

const now = new Date('2026-09-10T05:00:00Z');
const row = (overrides: GoogleSheetRow = {}): GoogleSheetRow => ({
  vehicleno: 'CAR-1', Fleet: 'North', username: 'Acme', datatime: '10/09/2026 11:59:00', recording: '1,2,3', ...overrides,
});
const build = (source: GoogleSheetRow, history?: UnitCameraHistory) => buildUnitRows([source], [], new Set(), now, 'Acme', history);
const remember = (source: GoogleSheetRow) => {
  const [unit] = build({ ...source, datatime: '10/09/2026 11:58:00' });
  return { [unit.cameraHistoryKey]: unit.cameraObservations };
};
const monitor = (source: GoogleSheetRow, history: UnitCameraHistory) => buildUnitMonitorRows(build(source, history), now)[0];
const check = (source: GoogleSheetRow, history: UnitCameraHistory, key: string) => monitor(source, history).checks.find((item) => item.key === key);

describe('camera installation learned from recording history', () => {
  it('remembers 1 when recording changes from 1,2,3 to 2,3 and recovers when 1 returns', () => {
    const history = remember(row());
    expect(history[Object.keys(history)[0]].map((item) => item.key)).toEqual(['c1', 'c2', 'c3']);
    const next = monitor(row({ recording: '2,3' }), JSON.parse(JSON.stringify(history)));
    expect(next.checks.filter((item) => /^c[1-9]$/.test(item.key))).toMatchObject([
      { key: 'c1', status: 'offline', present: true, missingFromRecording: true },
      { key: 'c2', status: 'online' }, { key: 'c3', status: 'online' },
    ]);
    expect(next.checks.some((item) => item.key === 'c4')).toBe(false);
    expect(getUnitMonitorDamage(next).map((item) => item.key)).toContain('c1');
    expect(check(row(), history, 'c1')?.status).toBe('online');
    expect(next.requiredPositions).toBeNull();
  });

  it.each([
    { recording: '' }, { recording: 'NA' }, { recording: 'broken payload' }, { recording: '2,3,garbage' },
    { recording: '2,3', datatime: '10/09/2026 11:40:00' }, { recording: '2,3', datatime: '' },
    { recording: '2,3', datatime: 'invalid' }, { recording: '2,3', datatime: '10/09/2026 12:01:00' },
  ] as GoogleSheetRow[])('keeps learned cameras present but Unknown for an unusable current report: %j', (overrides) => {
    const next = monitor(row(overrides), remember(row()));
    expect(next.checks.filter((item) => /^c[123]$/.test(item.key)).map((item) => item.status)).toEqual(['unknown', 'unknown', 'unknown']);
    expect(getUnitMonitorDamage(next).some((item) => /^c[123]$/.test(item.key))).toBe(false);
  });

  it('does not mistake a complete recording outage for inferred geofence', () => {
    const next = monitor(row({ recording: 'NotRecording', 'Expected Positions': 3 }), remember(row()));
    expect(next.geofence).toBeNull();
    expect(getUnitMonitorDamage(next).filter((item) => /^c[123]$/.test(item.key))).toHaveLength(3);
  });

  it('respects reported geofence, forced Intercom and the Reverse BSD movement gate', () => {
    const history = remember(row({ recording: 'Reverse BSD, Front' }));
    expect(getUnitMonitorDamage(monitor(row({ recording: 'Front', speed: 0 }), history)).some((item) => item.key === 'reverseBsd')).toBe(false);
    expect(getUnitMonitorDamage(monitor(row({ recording: 'Front', speed: 5 }), history)).some((item) => item.key === 'reverseBsd')).toBe(true);
    const geofenced = monitor(row({ recording: 'NotRecording', 'In Geofence': true }), history);
    expect(getUnitMonitorDamage(geofenced).some((item) => item.key === 'front')).toBe(false);
    expect(geofenced.checks.find((item) => item.key === 'intercom')?.status).toBe('online');
  });

  it('retains friendly camera identity after omission without creating a generic duplicate', () => {
    const history = remember(row({ recording: 'Front, Driver, AI' }));
    const next = monitor(row({ recording: 'Driver, AI' }), history);
    expect(next.checks.find((item) => item.key === 'front')).toMatchObject({ status: 'offline', missingFromRecording: true });
    expect(next.checks.some((item) => item.key === 'c1')).toBe(false);
    expect(next.checks.filter((item) => item.key === 'front' && item.present !== false)).toHaveLength(1);
  });

  it.each([['Front', 'Front Camera', 'front'], ['AI', 'AI Camera', 'ch1Ai']])('recognizes current aliases for remembered %s', (before, after, key) => {
    const history = remember(row({ recording: `${before}, Driver` }));
    expect(check(row({ recording: `${after}, Driver,` }), history, key)?.status).toBe('online');
  });

  it('does not infer installation from an unseen loss bit', () => {
    const history = remember(row());
    expect(check(row({ recording: '2,3', videoloss: '4,5,6,7,8,9' }), history, 'c4')).toBeUndefined();
    expect(build(row({ recording: '2,3', videoloss: '4' }))[0].cameraObservations.map((item) => item.key)).toEqual(['c2', 'c3']);
  });

  it('respects sparse and zero VSS inventory and explicit removals', () => {
    const history = remember(row());
    expect(monitor(row({ usableChs: 0, recording: '1,2,3' }), history).checks.some((item) => /^c[1-9]$/.test(item.key))).toBe(false);
    expect(monitor(row({ usableChs: 9, recording: '1,4' }), history).checks.filter((item) => /^c[1-9]$/.test(item.key)).map((item) => item.key)).toEqual(['c1', 'c4']);
    expect(check(row({ 'Required Equipment': 'Camera2, Camera3', recording: '2,3' }), history, 'c1')).toBeUndefined();
    expect(check(row({ 'Equipment Count': 0, recording: 'NotRecording' }), history, 'c1')).toBeUndefined();
    expect(check(row({ 'Required Equipment': 'Camera1, Camera4', recording: '1' }), {}, 'c4')?.status).toBe('offline');
  });

  it('keeps blank explicit component values Unknown despite historical omission', () => {
    const history = remember(row({ recording: 'Front, AI' }));
    expect(check(row({ recording: 'AI', Front: '' }), history, 'front')?.status).toBe('unknown');
    expect(check(row({ recording: '2,3', Camera1: '' }), remember(row()), 'c1')?.status).toBe('unknown');
  });

  it('does not learn invalid/future/absent reports, but can bootstrap positive older evidence', () => {
    expect(build(row({ recording: '2,garbage' }))[0].cameraObservations).toEqual([]);
    expect(build(row({ datatime: '10/09/2026 12:01:00' }))[0].cameraObservations).toEqual([]);
    expect(build(row({ datatime: '' }))[0].cameraObservations).toEqual([]);
    expect(build(row({ datatime: '01/09/2026 12:00:00' }))[0].cameraObservations).toHaveLength(3);
  });

  it.each(['10/09/2026 11:59:00', '10/09/2026 12:00:00'])('does not turn an older/equal snapshot into a new loss: %s', (datatime) => {
    const [latest] = build(row({ datatime: '10/09/2026 12:00:00' }));
    const history = { [latest.cameraHistoryKey]: latest.cameraObservations };
    expect(check(row({ datatime, recording: '2,3' }), history, 'c1')?.status).toBe('unknown');
    expect(check(row({ datatime, recording: '2,3', usableChs: 7 }), history, 'c1')?.status).toBe('unknown');
  });

  it('preserves fresh explicit video loss when recording is absent, while stale whole reports remain Unknown', () => {
    const history = remember(row({ recording: 'Front, Driver' }));
    expect(check(row({ recording: '', videoloss: 'Front' }), history, 'front')?.status).toBe('offline');
    expect(check(row({ recording: '', videoloss: 'Front', datatime: '10/09/2026 11:40:00' }), history, 'front')?.status).toBe('unknown');
    expect(check(row({ recording: '', usableChs: 1, lastStatusJson: JSON.stringify({ alarm: { videoLost: 1 } }) }), {}, 'c1')?.status).toBe('offline');
    expect(check(row({ recording: 'Front', videoloss: 'Front', usableChs: 1, channelname: 'Front',
      lastStatusJson: JSON.stringify({ module: { record: 1 }, alarm: { videoLost: 0 } }) }), {}, 'front')?.status).toBe('online');
  });

  it('isolates fleet and device identity and filters unauthorized rows before learning', () => {
    const history = remember(row({ 'Device ID': 'DEVICE-A' }));
    expect(check(row({ 'Device ID': 'DEVICE-B', recording: '2,3' }), history, 'c1')).toBeUndefined();
    expect(check(row({ Fleet: 'South', recording: '2,3' }), history, 'c1')).toBeUndefined();
    expect(buildUnitRows([row({ username: 'Other' }), row({ Fleet: 'South' })], [], new Set(['North']), now, 'Acme', history)).toEqual([]);
  });

  it('keeps earlier cameras and newest evidence during a degraded refresh', () => {
    const initial = remember(row());
    const [next] = build(row({ recording: '2,3' }));
    const merged = mergeUnitCameraHistory(initial, { [next.cameraHistoryKey]: next.cameraObservations });
    expect(check(row({ recording: '2,3' }), merged, 'c1')?.status).toBe('offline');
    expect(mergeUnitCameraHistory(merged, initial)).toEqual(merged);
    expect(initial[next.cameraHistoryKey].find((item) => item.key === 'c2')?.lastSeen).toBe('2026-09-10T04:58:00.000Z');
  });

  it('keeps vehicle identity stable when optional CH-derived fleet metadata is unavailable', () => {
    const raw = row({ Fleet: null });
    delete raw.Fleet;
    const [before] = buildUnitRows([raw], [{ 'Vehicle No': 'CAR-1', CH: 3, Fleet: 'North' }], new Set(), now, 'Acme');
    const [after] = buildUnitRows([{ ...raw, recording: '2,3' }], [], new Set(), now, 'Acme', { [before.cameraHistoryKey]: before.cameraObservations.map((item) => ({ ...item, lastSeen: '2026-09-10T04:58:00.000Z' })) });
    expect(before.fleet).toBe('North');
    expect(after.fleet).toBe('');
    expect(after.cameraHistoryKey).toBe(before.cameraHistoryKey);
    expect(buildUnitMonitorRows([after], now)[0].checks.find((item) => item.key === 'c1')?.status).toBe('offline');
  });

  it('isolates a repeated plate when source account membership distinguishes multiple authorized fleets', () => {
    const rows = [
      { vehicleno: 'SHARED-1', username: 'Acme,North', datatime: '10/09/2026 11:59:00', recording: '1' },
      { vehicleno: 'SHARED-1', username: 'Acme,South', datatime: '10/09/2026 11:59:00', recording: '2' },
    ];
    const units = buildUnitRows(rows, [], new Set(['North', 'South']), now, 'Acme');
    expect(units).toHaveLength(2);
    expect(new Set(units.map((unit) => unit.cameraHistoryKey)).size).toBe(2);
  });
});
