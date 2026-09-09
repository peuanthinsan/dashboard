import { describe, expect, it } from 'vitest';
import type { GoogleSheetRow } from './googleSheetParse';
import {
  buildInstallRows,
  buildUnitRows,
  hasUnitStatusColumns,
  isReportedValue,
  readUnitHealth,
} from './unitStatusData';

const now = new Date('2026-09-09T05:00:00Z'); // 12:00 Bangkok
const noScope = new Set<string>();
const sourceRow = (overrides: GoogleSheetRow = {}): GoogleSheetRow => ({
  vehicleno: 'V1',
  username: 'SONGDEEAPI, Acme',
  lastupdatedtime: '09/09/2026 11:50:00',
  ...overrides,
});
const cameraRow = (overrides: GoogleSheetRow = {}): GoogleSheetRow => ({
  'Vehicle No': 'V1', CH: 5, Fleet: 'North', ...overrides,
});

describe('company and fleet boundaries', () => {
  it('supports every configured company using an exact comma-separated membership token', () => {
    for (const company of ['Acme', 'BIGTH', 'Vehicle', 'New Customer']) {
      const rows = [
        sourceRow({ vehicleno: 'V1', username: `SONGDEEAPI, ${company}` }),
        sourceRow({ vehicleno: 'V2', username: ` ${company.toUpperCase()} , another` }),
        sourceRow({ vehicleno: 'excluded1', username: `${company} Logistics` }),
        sourceRow({ vehicleno: 'excluded2', username: `My${company}, SONGDEEAPI` }),
        sourceRow({ vehicleno: 'excluded3', username: '' }),
        sourceRow({ vehicleno: 'excluded4', username: null }),
        { vehicleno: 'excluded5' },
      ];
      expect(buildUnitRows(rows, [], noScope, now, company).map((unit) => unit.vehicleNo))
        .toEqual(['V1', 'V2']);
    }
  });

  it('does not impose Vehicle membership on a pre-scoped sheet without usernames', () => {
    const units = buildUnitRows([{ 'Vehicle No': 'BIG-1', 'GPS Status': 'online' }], [], noScope, now, 'BIGTH');
    expect(units.map((unit) => unit.vehicleNo)).toEqual(['BIG-1']);
  });

  it('enforces company membership and authorized Fleet independently when both are present', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', Fleet: ' North ' }),
      sourceRow({ vehicleno: 'wrong-fleet', Fleet: 'South' }),
      sourceRow({ vehicleno: 'wrong-company', Fleet: 'North', username: 'Other Company' }),
    ];
    expect(buildUnitRows(rows, [], new Set([' NORTH ']), now, 'Acme').map((unit) => unit.vehicleNo))
      .toEqual(['V1']);
  });

  it('rejects missing, blank, or mismatched Fleet whenever any row establishes the Fleet schema', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', ' FLEET NAME ': ' NORTH ' }),
      sourceRow({ vehicleno: 'V2', ' FLEET NAME ': 'south' }),
      sourceRow({ vehicleno: 'V3' }),
      sourceRow({ vehicleno: 'V4', ' FLEET NAME ': ' ' }),
      sourceRow({ vehicleno: 'V5', ' FLEET NAME ': null }),
    ];
    const metadata = rows.map((row) => cameraRow({ 'Vehicle No': row.vehicleno }));
    expect(buildUnitRows(rows, metadata, new Set(['north']), now, 'Acme').map((unit) => unit.vehicleNo))
      .toEqual(['V1']);
    expect(buildUnitRows([
      sourceRow(),
      sourceRow({ vehicleno: 'excluded', username: 'Other', Fleet: null }),
    ], [cameraRow()], new Set(['North']), now, 'Acme')).toEqual([]);
  });

  it('uses an exact scoped username token when a raw source has no Fleet or CH metadata', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', username: 'Acme, NORTH' }),
      sourceRow({ vehicleno: 'V2', username: 'Acme, North West' }),
      sourceRow({ vehicleno: 'V3', username: 'Acme' }),
    ];
    expect(buildUnitRows(rows, [], new Set(['north']), now, 'Acme').map((unit) => unit.vehicleNo))
      .toEqual(['V1']);
  });

  it('skips blank and repeated header vehicle identifiers', () => {
    const rows = ['', ' ', 'vehicleno', ' Vehicle No ', 'VEHICLE NUMBER', 'V1']
      .map((vehicleno) => sourceRow({ vehicleno }));
    expect(buildUnitRows(rows, [], noScope, now).map((unit) => unit.vehicleNo)).toEqual(['V1']);
  });
});

describe('CH metadata and installation totals', () => {
  it('joins CH by a normalized vehicle identifier or the source Code No', () => {
    const rows = [
      sourceRow({ vehicleno: ' V1 ' }),
      sourceRow({ vehicleno: 'Registration 2', 'Code No': 415 }),
    ];
    const metadata = [cameraRow({ 'Vehicle No': 'v1', CH: 6 }), cameraRow({ 'Vehicle No': 415, CH: 9 })];
    expect(buildUnitRows(rows, metadata, new Set(['North']), now, 'Acme').map((unit) =>
      [unit.vehicleNo, unit.fleet, unit.expectedCameras])).toEqual([
      ['Registration 2', 'North', 9], ['V1', 'North', 6],
    ]);
  });

  it('does not guess a CH match shared by different fleets and uses explicit fleet to disambiguate', () => {
    const metadata = [cameraRow({ Fleet: 'North', CH: 5 }), cameraRow({ Fleet: 'South', CH: 9 })];
    const [ambiguous] = buildUnitRows([sourceRow()], metadata, noScope, now, 'Acme');
    expect(ambiguous).toMatchObject({ fleet: '', expectedCameras: null });
    const [explicit] = buildUnitRows([sourceRow({ Fleet: 'South' })], metadata, noScope, now, 'Acme');
    expect(explicit).toMatchObject({ fleet: 'South', expectedCameras: 9 });
    const [scoped] = buildUnitRows([sourceRow()], metadata, new Set(['North']), now, 'Acme');
    expect(scoped).toMatchObject({ fleet: 'North', expectedCameras: 5 });
  });

  it('leaves missing or invalid expected camera counts unknown while preserving a real zero', () => {
    for (const value of ['', null, 'unknown', -1, 1.5]) {
      const [unit] = buildUnitRows([sourceRow()], [cameraRow({ CH: value })], noScope, now);
      expect(unit.expectedCameras).toBeNull();
    }
    const [zero] = buildUnitRows([sourceRow()], [cameraRow({ CH: 0 })], noScope, now);
    expect(zero.expectedCameras).toBe(0);
  });

  it('counts camera setup from exactly CH1 AI, Front, Rear Right, Rear Left, and Cabin', () => {
    const [unit] = buildUnitRows([sourceRow({
      'CH1 AI': '✔', Front: 'online', 'Rear Right': '✖', 'Rear Left': '-', Cabin: 'ready',
      'Reverse BSD': 'online', 'Front BSD': 'online', 'Left BSD': 'online', 'Right BSD': 'online',
    })], [cameraRow({ CH: 9 })], noScope, now);
    expect(unit.activeCameras).toBe(3);
    expect(unit.expectedCameras).toBe(9);
  });

  it('keeps installation totals within hard scope independently of vehicle filters', () => {
    const metadata = [
      cameraRow({ 'Vehicle No': 'V1', CH: 5 }),
      cameraRow({ 'Vehicle No': 'V2', CH: 9 }),
      cameraRow({ 'Vehicle No': 'v2', Fleet: 'NORTH', CH: 9 }),
      cameraRow({ 'Vehicle No': 'S1', Fleet: 'South', CH: 6 }),
      cameraRow({ 'Vehicle No': 'foreign', Fleet: 'Other Company', CH: 99 }),
    ];
    const units = buildUnitRows([sourceRow()], metadata, new Set(['North']), now, 'Acme');
    expect(buildInstallRows(metadata, units, new Set(['North'])))
      .toEqual([{ fleet: 'North', vehicles: 2, cameras: 14, unknownCameraUnits: 0 }]);
    expect(buildInstallRows(metadata, [], new Set(['North'])))
      .toEqual([{ fleet: 'North', vehicles: 2, cameras: 14, unknownCameraUnits: 0 }]);
  });

  it('bounds unscoped installation totals to established company fleets', () => {
    const rows = [sourceRow({ Fleet: 'North' }), sourceRow({ vehicleno: 'foreign', Fleet: 'Other', username: 'Other' })];
    const metadata = [cameraRow(), cameraRow({ 'Vehicle No': 'V2', CH: 9 }), cameraRow({ 'Vehicle No': 'foreign', Fleet: 'Other', CH: 99 })];
    const units = buildUnitRows(rows, metadata, noScope, now, 'Acme');
    expect(buildInstallRows(metadata, units)).toEqual([{ fleet: 'North', vehicles: 2, cameras: 14, unknownCameraUnits: 0 }]);
    expect(buildInstallRows(metadata, [])).toEqual([]);
  });

  it('retains scoped installation vehicles with missing CH while adding no invented cameras', () => {
    const metadata = [cameraRow({ CH: null }), cameraRow({ 'Vehicle No': 'V2', CH: 5 })];
    expect(buildInstallRows(metadata, [], new Set(['North'])))
      .toEqual([{ fleet: 'North', vehicles: 2, cameras: 5, unknownCameraUnits: 1 }]);
  });
});

describe('common BIGTH device status requirements', () => {
  it('recognizes BIGTH healthy vocabulary and actual sheet check marks', () => {
    for (const value of ['online', 'normal', 'ok', 'active', 'good', 'ready', 'working', '✔', '✓', '✅']) {
      expect(readUnitHealth(value), value).toBe('online');
    }
  });

  it('gives failures and cross marks precedence over healthy substrings', () => {
    for (const value of ['offline', 'abnormal', 'online but no signal', 'ready / error', 'normal with damage', '✔ ✖', '✗', '✕', '×', '❌']) {
      expect(readUnitHealth(value), value).toBe('offline');
    }
    for (const value of ['NonExist', 'storageNonExist', 'Abnormal', 'not exist']) {
      const [unit] = buildUnitRows([sourceRow({ storagestatus: value })], [], noScope, now);
      expect(unit.statuses.storage, value).toBe('offline');
    }
  });

  it('does not confuse negative words with healthy substrings or invent health from negated failures', () => {
    for (const value of ['Inactive', 'No Network', 'Not Ready', 'Broken', 'not working', 'online but not recording']) {
      expect(readUnitHealth(value), value).toBe('offline');
    }
    for (const value of ['network', 'token', 'No Damage', 'no errors', 'not offline']) {
      expect(readUnitHealth(value), value).toBe('unknown');
    }
    expect(readUnitHealth('online, no damage')).toBe('online');
    expect(readUnitHealth('no damage but signal lost')).toBe('offline');
  });

  it('does not use a health reading as device type when type data is missing', () => {
    const [unit] = buildUnitRows([sourceRow({ 'Device Status': 'online' })], [], noScope, now);
    expect(unit.type).toBe('');
    expect(unit.statuses.deviceStatus).toBe('online');
  });

  it('keeps blank and not-reported status values unknown rather than recording damage', () => {
    const [unit] = buildUnitRows([sourceRow({ 'GPS Status': '-', 'Device Status': '', 'Status AI': 'N/A', Storage: null })], [], noScope, now);
    expect(Object.values(unit.statuses).filter((status) => status === 'offline')).toEqual([]);
    expect(unit.statuses).toMatchObject({ gpsStatus: 'unknown', deviceStatus: 'unknown', statusAi: 'unknown', storage: 'unknown' });
    for (const value of ['', ' ', '-', '—', 'NA', 'n/a', 'none', 'null', 'unrecognized']) {
      expect(readUnitHealth(value), value).toBe('unknown');
    }
  });

  it('forces Intercom online for every company regardless of source status, update age, or GPS', () => {
    for (const company of ['Acme', 'BIGTH', 'Vehicle']) {
      for (const overrides of [
        { Intercom: 'offline', gps: false, lastupdatedtime: '09/09/2026 10:00:00' },
        { Intercom: '✖', gps: 'online', lastupdatedtime: 'invalid' },
        { Intercom: '-', gps: '', lastupdatedtime: null },
      ]) {
        const [unit] = buildUnitRows([sourceRow({ username: company, ...overrides })], [], noScope, now, company);
        expect(unit.statuses.intercom).toBe('online');
      }
    }
  });

  it('uses explicit status columns in preference to contradictory raw telemetry', () => {
    const [unit] = buildUnitRows([sourceRow({
      'GPS Status': 'offline', gps: true,
      Storage: 'offline', storagestatus: 'Exist',
      ' Front ': '-', 'Rear Right': 'online',
      recording: 'Front', videoloss: 'Rear Right',
    })], [], noScope, now);
    expect(unit.statuses).toMatchObject({ gpsStatus: 'offline', storage: 'offline', front: 'unknown', rearRight: 'online' });
    expect(unit.gps).toBe('offline');
  });

  it('matches literal named camera recording/loss, with loss winning, and leaves unmapped channels unknown', () => {
    const [unit] = buildUnitRows([sourceRow({
      recording: 'Front, Rear Left, Rear Right, AI, Driver, Reverse 1',
      videoloss: ' Rear Left , 7, 8',
    })], [], noScope, now);
    expect(unit.statuses).toMatchObject({
      front: 'online', rearLeft: 'offline', rearRight: 'online', ch1Ai: 'unknown',
      cabin: 'unknown', reverseBsd: 'unknown', frontBsd: 'unknown', leftBsd: 'unknown', rightBsd: 'unknown',
    });
    const [numeric] = buildUnitRows([sourceRow({ recording: '1, 2, 3, 4, 5', videoloss: '6, 7, 8' })], [], noScope, now);
    expect(numeric.activeCameras).toBe(0);
    expect(Object.entries(numeric.statuses).filter(([key, status]) => key !== 'intercom' && status !== 'unknown')).toEqual([]);
  });

  it('preserves raw camera names and zero telemetry for unit details', () => {
    const recording = 'Front, Rear Left, AI, Driver, Reverse 1';
    const [unit] = buildUnitRows([sourceRow({
      recording, videoloss: '7, 8', storagestatus: 'Exist', gps: true,
      speed: 0, direction: 0, hdop: 0, networksignal: '4G', location: ' Bangkok ',
    })], [], noScope, now);
    expect(unit).toMatchObject({ recording, videoLoss: '7, 8', storageRaw: 'Exist', gps: 'true',
      speed: '0', direction: '0', hdop: '0', network: '4G', location: ' Bangkok ' });
  });
});

describe('update time and deduplication', () => {
  it('applies a 30-minute Bangkok update boundary independently of reported health', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', lastupdatedtime: '09/09/2026 11:30:00', 'GPS Status': 'offline' }),
      sourceRow({ vehicleno: 'V2', lastupdatedtime: '09/09/2026 11:29:59', 'GPS Status': 'online' }),
      sourceRow({ vehicleno: 'V3', lastupdatedtime: '09/09/2026 12:00:01', 'GPS Status': 'online' }),
    ];
    const units = buildUnitRows(rows, [], noScope, now);
    expect(units.map((unit) => unit.updateStatus)).toEqual(['recent', 'stale', 'unknown']);
    expect(units.map((unit) => unit.statuses.gpsStatus)).toEqual(['offline', 'online', 'online']);
    expect(units[0].updatedAt?.toISOString()).toBe('2026-09-09T11:30:00.000Z');
    expect(units[2].updatedAt).toBeNull();
  });

  it('uses dataTime only when API update time is blank and preserves an invalid explicit API time', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', lastupdatedtime: ' ', datatime: '09/09/2026 11:50:00' }),
      sourceRow({ vehicleno: 'V2', lastupdatedtime: null, 'Date & time': '09/09/2026 11:50:00' }),
      sourceRow({ vehicleno: 'V3', lastupdatedtime: 'NA', datatime: '09/09/2026 11:50:00' }),
      sourceRow({ vehicleno: 'V4', lastupdatedtime: null }),
    ];
    const units = buildUnitRows(rows, [], noScope, now);
    expect(units.map((unit) => unit.updateStatus)).toEqual(['recent', 'recent', 'unknown', 'unknown']);
    expect(units[2].updatedRaw).toBe('NA');
  });

  it('chooses the newest valid duplicate within a fleet while retaining distinct fleets and first ties', () => {
    const rows = [
      sourceRow({ vehicleno: ' V1 ', Fleet: 'North', location: 'old', lastupdatedtime: '09/09/2026 11:00:00' }),
      sourceRow({ vehicleno: 'v1', Fleet: 'north', location: 'newest' }),
      sourceRow({ vehicleno: 'V1', Fleet: 'North', location: 'tie' }),
      sourceRow({ vehicleno: 'V1', Fleet: 'North', location: 'invalid', lastupdatedtime: 'bad' }),
      sourceRow({ vehicleno: 'V1', Fleet: 'North', location: 'future', lastupdatedtime: '09/09/2026 12:00:01' }),
      sourceRow({ vehicleno: 'V1', Fleet: 'South', location: 'other-fleet' }),
      sourceRow({ vehicleno: 'V2', Fleet: 'North', location: 'unknown-first', lastupdatedtime: '' }),
      sourceRow({ vehicleno: 'v2', Fleet: 'North', location: 'valid-second' }),
    ];
    const units = buildUnitRows(rows, [], noScope, now, 'Acme');
    expect(units.map((unit) => [unit.fleet, unit.location])).toEqual([
      ['north', 'newest'], ['South', 'other-fleet'], ['North', 'valid-second'],
    ]);
  });
});

describe('source schema and absent values', () => {
  it('accepts raw and prepared unit status schemas using recognized vehicle aliases', () => {
    for (const vehicleHeader of ['vehicleno', ' Vehicle No ', 'VEHICLE NUMBER']) {
      for (const statusHeader of ['GPS Status', 'gps', 'lastupdatedtime', 'Date & time', 'datatime']) {
        expect(hasUnitStatusColumns([{ label: vehicleHeader }, { label: statusHeader }])).toBe(true);
      }
    }
    expect(hasUnitStatusColumns([])).toBe(false);
    expect(hasUnitStatusColumns([{ label: 'vehicleno' }])).toBe(false);
    expect(hasUnitStatusColumns([{ label: 'GPS Status' }])).toBe(false);
    expect(hasUnitStatusColumns([{ label: 'Vehicle-No' }, { label: 'gps' }])).toBe(false);
  });

  it('ignores absent tokens while preserving zero and false', () => {
    for (const value of ['', ' ', '-', '—', 'NA', ' n/a ', 'None', 'NULL']) expect(isReportedValue(value)).toBe(false);
    for (const value of ['0', 'FALSE', '7, 8', 'storageExist', 'Reverse 1']) expect(isReportedValue(value)).toBe(true);
  });
});
