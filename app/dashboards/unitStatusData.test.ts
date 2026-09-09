import { describe, expect, it } from 'vitest';
import type { GoogleSheetRow } from './googleSheetParse';
import {
  buildInstallRows,
  buildUnitRows,
  getUnitCameraChecks,
  getUnitChecks,
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
const unknownCameraChannels = {
  1: 'unknown', 2: 'unknown', 3: 'unknown', 4: 'unknown', 5: 'unknown',
  6: 'unknown', 7: 'unknown', 8: 'unknown', 9: 'unknown',
} as const;

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

  it('accepts the ALCHEM source username alias and canonical name as exact normalized tokens', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', username: ' Alcsongdee, SONGDEEAPI' }),
      sourceRow({ vehicleno: 'V2', username: ' Alcsongdee' }),
      sourceRow({ vehicleno: 'V3', username: ' SONGDEEAPI , aLcSoNgDeE ' }),
      sourceRow({ vehicleno: 'V4', username: 'ALCHEM' }),
    ];
    expect(buildUnitRows(rows, [], noScope, now, ' ALCHEM ').map((unit) => unit.vehicleNo))
      .toEqual(['V1', 'V2', 'V3', 'V4']);
  });

  it('rejects ALCHEM alias near-matches, foreign memberships, and missing usernames', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', username: 'Alcsongdee Logistics' }),
      sourceRow({ vehicleno: 'V2', username: 'MyAlcsongdee, SONGDEEAPI' }),
      sourceRow({ vehicleno: 'V3', username: 'Alcsongdee2' }),
      sourceRow({ vehicleno: 'V4', username: 'Other Company' }),
      sourceRow({ vehicleno: 'V5', username: '' }),
      sourceRow({ vehicleno: 'V6', username: null }),
      { vehicleno: 'V7' },
    ];
    expect(buildUnitRows(rows, [], noScope, now, 'ALCHEM')).toEqual([]);
    expect(buildUnitRows([sourceRow({ username: 'Alcsongdee' })], [], noScope, now, 'Acme'))
      .toEqual([]);
  });

  it('keeps ALCHEM alias membership subject to the authorized Fleet boundary', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', username: 'Alcsongdee', Fleet: 'North' }),
      sourceRow({ vehicleno: 'V2', username: 'Alcsongdee', Fleet: 'South' }),
      sourceRow({ vehicleno: 'V3', username: 'Alcsongdee' }),
      sourceRow({ vehicleno: 'V4', username: 'Alcsongdee', Fleet: '' }),
    ];
    const metadata = rows.map((row) => cameraRow({ 'Vehicle No': row.vehicleno }));
    expect(buildUnitRows(rows, metadata, new Set(['North']), now, 'ALCHEM').map((unit) => unit.vehicleNo))
      .toEqual(['V1']);
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
    expect(numeric.activeCameras).toBe(5);
    expect(numeric.statuses).toMatchObject({ ch1Ai: 'unknown', front: 'unknown', rearRight: 'unknown', rearLeft: 'unknown', cabin: 'unknown' });
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

describe('shared camera channels and overall unit health', () => {
  it('restores HOWEN named cameras and Alchem AI/Driver loss without requiring CH metadata', () => {
    const [unit] = buildUnitRows([sourceRow({
      username: 'Alcsongdee, SONGDEEAPI', gps: true, devicetype: 'HOWEN',
      recording: 'Front, Driver, AI, Rear Right, Rear Left', videoloss: 'AI, Driver',
    })], [], noScope, now, 'ALCHEM');
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 2: 'offline', 3: 'offline', 4: 'online', 5: 'online' });
    expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => check.key)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    expect(unit).toMatchObject({ cameraSource: 'channels', activeCameras: 3, expectedCameras: null, overallStatus: 'warning' });
    expect(unit.statuses).toMatchObject({ ch1Ai: 'unknown', cabin: 'unknown', intercom: 'online' });
    expect(unit.videoLoss).toBe('AI, Driver');
  });

  it('reads numeric MDVR channels with loss precedence and leaves unobserved channels blank', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, devicetype: 'MDVR', recording: '1, 2, 4', videoloss: '2, 7, 8',
    })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 2: 'offline', 4: 'online' });
    expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => check.key)).toEqual(['c1', 'c2', 'c4']);
    expect(unit).toMatchObject({ cameraSource: 'channels', activeCameras: 2, expectedCameras: null, overallStatus: 'warning' });
    expect(unit.statuses).toMatchObject({ ch1Ai: 'unknown', front: 'unknown', rearRight: 'unknown', rearLeft: 'unknown', cabin: 'unknown' });
  });

  it('uses explicit Vinythai CH2 aliases over recording and video loss, including a blank unknown', () => {
    for (const alias of ['Camera CH2', 'CH2', 'C2', 'Camera2']) {
      for (const [value, status] of [['connected', 'online'], ['offline', 'offline'], ['', 'unknown']] as const) {
        const [unit] = buildUnitRows([sourceRow({
          username: 'Vinythai', gps: true, recording: '1, 2, 3, 4, 5', videoloss: '2', [alias]: value,
        })], [], noScope, now, 'Vinythai');
        expect(unit.cameraChannels[2], `${alias}: ${value}`).toBe(status);
        expect(unit.cameraSource).toBe('channels');
        expect(unit.activeCameras).toBe(status === 'online' ? 5 : 4);
        expect(unit.statuses.ch1Ai).toBe('unknown');
      }
    }
  });

  it('does not invent installed cameras from NotRecording and records only known named losses', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, recording: ' NotRecording ', videoloss: 'NA' })], [], noScope, now);
    expect(unit.cameraChannels).toEqual(unknownCameraChannels);
    expect(Object.values(unit.cameraPresent)).toEqual(Array(9).fill(false));
    expect(unit).toMatchObject({ activeCameras: 0, cameraSource: 'channels', overallStatus: 'unknown' });
    expect(unit.statuses.intercom).toBe('online');
    const [knownLoss] = buildUnitRows([sourceRow({ gps: true, recording: 'NotRecording', videoloss: 'Driver' })], [], noScope, now);
    expect(knownLoss.cameraChannels).toEqual({ ...unknownCameraChannels, 2: 'offline' });
    expect(getUnitCameraChecks(knownLoss).filter((check) => check.present).map((check) => check.key)).toEqual(['c2']);
    expect(knownLoss.overallStatus).toBe('warning');
  });

  it('keeps absent and unrecognized camera lists unknown instead of inventing five failures', () => {
    for (const value of ['', 'NA', 'N/A', 'none', 'Reverse 1', '10, 11', 'unrecognized']) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, recording: value, videoloss: value })], [], noScope, now);
      expect(unit.cameraChannels, value).toEqual(unknownCameraChannels);
      expect(Object.values(unit.cameraPresent), value).toEqual(Array(9).fill(false));
      expect(unit).toMatchObject({ activeCameras: 0, cameraSource: 'channels', overallStatus: 'unknown' });
    }
  });

  it('records recognized loss without claiming health or failure for unreported other channels', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, recording: 'NA', videoloss: 'Driver' })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 2: 'offline' });
    expect(unit.overallStatus).toBe('warning');
  });

  it('keeps prepared BIGTH checklist authority when raw channel telemetry disagrees', () => {
    const checklist = { 'GPS Status': 'online', 'CH1 AI': 'online', Front: 'online', 'Rear Right': 'online', 'Rear Left': 'online', Cabin: 'online' };
    const [healthy] = buildUnitRows([sourceRow({ ...checklist, recording: 'NotRecording' })], [], noScope, now);
    expect(healthy.cameraChannels).toEqual(unknownCameraChannels);
    expect(healthy).toMatchObject({ cameraSource: 'checklist', activeCameras: 5, expectedCameras: null, overallStatus: 'healthy' });
    const [warning] = buildUnitRows([sourceRow({ ...checklist, Front: 'offline', recording: '1, 2, 3, 4, 5' })], [], noScope, now);
    expect(warning).toMatchObject({ cameraSource: 'channels', activeCameras: 4, overallStatus: 'warning' });
    expect(warning.cameraChannels[1]).toBe('online');
    expect(warning.statuses.front).toBe('offline');
    expect(getUnitChecks(warning)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'front', status: 'offline' }),
    ]));
  });

  it('does not let a blank checklist column hide independent channel evidence', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, Front: '', recording: '1, 2, 3, 4, 5' })], [], noScope, now);
    expect(unit.cameraChannels[1]).toBe('online');
    expect(unit).toMatchObject({ cameraSource: 'channels', activeCameras: 5, overallStatus: 'healthy' });
    expect(unit.statuses.front).toBe('unknown');
  });

  it('keeps a named rear-camera failure visible beside a reported BIGTH Front status', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, Front: 'online', videoloss: 'Rear Right' })], [], noScope, now);
    expect(getUnitChecks(unit)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'front', status: 'online' }),
      expect.objectContaining({ key: 'c4', status: 'offline', present: true }),
    ]));
    expect(unit.statuses).toMatchObject({ front: 'online', rearRight: 'offline' });
    expect(unit).toMatchObject({ cameraSource: 'channels', overallStatus: 'warning' });
  });

  it('keeps independent Camera 9 and AI losses visible beside a nonblank Front checklist status', () => {
    const cases: Array<{ row: GoogleSheetRow; failedKey: string }> = [
      { row: { recording: 'Front', Camera9: 'offline' }, failedKey: 'c9' },
      { row: { recording: 'Front, AI', videoloss: 'AI' }, failedKey: 'c3' },
    ];
    for (const { row, failedKey } of cases) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, Front: 'online', ...row })], [], noScope, now);
      expect(getUnitChecks(unit)).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'c1', status: 'online', present: true }),
        expect.objectContaining({ key: failedKey, status: 'offline', present: true }),
      ]));
      expect(unit).toMatchObject({ cameraSource: 'channels', activeCameras: 1, overallStatus: 'warning' });
    }
  });

  it('keeps a literal Cabin failure visible alongside raw channel cameras', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, recording: 'Front', videoloss: 'Cabin' })], [], noScope, now);
    expect(getUnitChecks(unit)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'c1', status: 'online', present: true }),
      expect.objectContaining({ key: 'cabin', status: 'offline' }),
    ]));
    expect(unit).toMatchObject({ cameraSource: 'channels', activeCameras: 1, overallStatus: 'warning' });
  });

  it('counts explicit positional failures once when the same literal camera is represented by a raw slot', () => {
    for (const [name, key] of [['Front', 'c1'], ['Rear Right', 'c4'], ['Rear Left', 'c5']]) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, recording: name, [name]: 'offline' })], [], noScope, now);
      const failures = getUnitChecks(unit).filter((check) => check.status === 'offline');
      expect(failures.map((check) => check.key), name).toEqual([key]);
      expect(unit.overallStatus).toBe('warning');
    }
  });

  it('retains a conflicting explicit positional check when a direct raw status blocks its override', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, recording: 'Front', Front: 'offline', Camera1: 'online' })], [], noScope, now);
    expect(getUnitChecks(unit)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'front', status: 'offline' }),
      expect.objectContaining({ key: 'c1', status: 'online', present: true }),
    ]));
    expect(unit.overallStatus).toBe('warning');
  });

  it('prioritizes stale updates, GPS offline, or device offline over camera health', () => {
    const cases: GoogleSheetRow[] = [
      { lastupdatedtime: '09/09/2026 11:29:59' },
      { gps: false },
      { 'Device Status': 'offline' },
    ];
    for (const overrides of cases) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, recording: '1, 2, 3, 4, 5', ...overrides })], [], noScope, now);
      expect(unit.activeCameras).toBe(5);
      expect(unit.overallStatus).toBe('offline');
      expect(unit.statuses.intercom).toBe('online');
    }
  });

  it('reports other checklist failures as warnings when GPS and cameras are healthy', () => {
    for (const field of ['Status AI', 'Storage', 'Seat Vibrator', 'Reverse BSD']) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, recording: '1, 2, 3, 4, 5', [field]: 'offline' })], [], noScope, now);
      expect(unit.overallStatus, field).toBe('warning');
    }
  });

  it('requires GPS and some camera evidence for healthy status; Intercom alone is insufficient', () => {
    const rows = [
      sourceRow({ vehicleno: 'V1', gps: true, recording: '1, 2, 3, 4, 5' }),
      sourceRow({ vehicleno: 'V2', recording: '1, 2, 3, 4, 5' }),
      sourceRow({ vehicleno: 'V3', gps: true }),
      sourceRow({ vehicleno: 'V4' }),
    ];
    const units = buildUnitRows(rows, [], noScope, now);
    expect(units.map((unit) => unit.overallStatus)).toEqual(['healthy', 'unknown', 'unknown', 'unknown']);
    expect(units.map((unit) => unit.statuses.intercom)).toEqual(['online', 'online', 'online', 'online']);
  });
});

describe('VSS camera inventory and health masks', () => {
  it('supports all nine installed numeric cameras using decimal inventory and hexadecimal health', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, usableChs: 511,
      lastStatusJson: JSON.stringify({ module: { record: '0x1ff' }, alarm: { videoLost: '0x0' } }),
    })], [], noScope, now);
    expect(unit).toMatchObject({ cameraInventoryKnown: true, expectedCameras: 9, activeCameras: 9, overallStatus: 'healthy' });
    expect(Object.values(unit.cameraPresent)).toEqual(Array(9).fill(true));
    expect(Object.values(unit.cameraChannels)).toEqual(Array(9).fill('online'));
    expect(getUnitCameraChecks(unit).map((check) => check.key)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9']);
  });

  it('treats mask 9 as sparse C1 and C4 inventory and ignores loss bits on unused inputs', () => {
    for (const usableChs of [9, '9', '0x9']) {
      const [unit] = buildUnitRows([sourceRow({
        gps: true, usableChs, channelname: 'Cabin;CH2;CH3;Road;CH5;CH6;CH7;CH8;CH9',
        lastStatusJson: JSON.stringify({ module: { record: 9 }, alarm: { videoLost: 502 } }),
      })], [], noScope, now);
      expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 4: 'online' });
      expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => [check.key, check.en]))
        .toEqual([['c1', 'Cabin'], ['c4', 'Road']]);
      expect(getUnitChecks(unit).filter((check) => /^c\d$/.test(check.key)).map((check) => check.key)).toEqual(['c1', 'c4']);
      expect(unit).toMatchObject({ cameraInventoryKnown: true, expectedCameras: 2, activeCameras: 2, overallStatus: 'healthy' });
    }
  });

  it('accepts inventory and health from the raw payload wrapper and gives installed loss precedence', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true,
      raw_payload: JSON.stringify({ usableChs: '0x9', channelname: 'Front;CH2;CH3;Rear',
        lastStatusJson: JSON.stringify({ module: { record: '0x9' }, alarm: { videoLost: '0x8' } }),
      }),
    })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 4: 'offline' });
    expect(unit).toMatchObject({ expectedCameras: 2, activeCameras: 1, overallStatus: 'warning' });
    expect(unit.cameraLabels[4]).toBe('Rear');
  });

  it('counts an explicit Front failure once when VSS names place that same camera on slot 4', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, usableChs: 9, channelname: 'Cabin;;;Front', Front: 'offline',
      lastStatusJson: JSON.stringify({ module: { record: 9 }, alarm: { videoLost: 0 } }),
    })], [], noScope, now);
    expect(getUnitChecks(unit).filter((check) => check.status === 'offline').map((check) => check.key)).toEqual(['c4']);
    expect(unit.statuses.front).toBe('offline');
    expect(unit).toMatchObject({ activeCameras: 1, overallStatus: 'warning' });
  });

  it('marks a known installed camera offline when its recording bit is clear even without a loss bit', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, usableChs: 9,
      lastStatusJson: JSON.stringify({ module: { record: 1 }, alarm: { videoLost: 0 } }),
    })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 4: 'offline' });
    expect(unit.cameraPresent[4]).toBe(true);
    expect(unit.statuses.deviceStatus).toBe('unknown');
    expect(unit.overallStatus).toBe('warning');
  });

  it('treats a zero inventory mask as no installed cameras despite telemetry on unused inputs', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, usableChs: 0, recording: '1, 2, 3, 4, 5, 6, 7, 8, 9', videoloss: '2, 8', Camera2: 'online',
      lastStatusJson: JSON.stringify({ module: { record: 511 }, alarm: { videoLost: 511 } }),
    })], [], noScope, now);
    expect(unit.cameraChannels).toEqual(unknownCameraChannels);
    expect(Object.values(unit.cameraPresent)).toEqual(Array(9).fill(false));
    expect(unit).toMatchObject({ cameraInventoryKnown: true, expectedCameras: 0, activeCameras: 0, overallStatus: 'healthy' });
    expect(getUnitChecks(unit).filter((check) => /^c\d$/.test(check.key))).toEqual([]);
    const [unknownGps] = buildUnitRows([sourceRow({ usableChs: 0 })], [], noScope, now);
    expect(unknownGps.overallStatus).toBe('unknown');
  });

  it('rejects invalid inventory masks and uses only observed camera evidence as fallback', () => {
    for (const usableChs of ['', '9oops', '0xNO', -1, 1.5, 65536, true]) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, usableChs, recording: '1, 4', videoloss: '2, 9' })], [], noScope, now);
      expect(unit.cameraChannels, String(usableChs)).toEqual({ ...unknownCameraChannels, 1: 'online', 4: 'online' });
      expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => check.key)).toEqual(['c1', 'c4']);
      expect(unit).toMatchObject({ cameraInventoryKnown: false, expectedCameras: null, activeCameras: 2, overallStatus: 'healthy' });
    }
  });

  it('preserves known inventory but keeps missing or invalid health unknown', () => {
    for (const lastStatusJson of [
      '', 'malformed', '[]', '{}',
      JSON.stringify({ module: { record: '9oops' }, alarm: { videoLost: 0 } }),
      JSON.stringify({ module: { record: -1 }, alarm: { videoLost: 'invalid' } }),
    ]) {
      const [unit] = buildUnitRows([sourceRow({ gps: true, usableChs: 9, lastStatusJson })], [], noScope, now);
      expect(unit.cameraChannels, lastStatusJson).toEqual(unknownCameraChannels);
      expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => check.key)).toEqual(['c1', 'c4']);
      expect(unit).toMatchObject({ cameraInventoryKnown: true, expectedCameras: 2, activeCameras: 0, overallStatus: 'unknown' });
    }
  });

  it('keeps an explicitly blank installed camera unknown even when the health mask reports recording', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, usableChs: 3, Camera2: '',
      lastStatusJson: JSON.stringify({ module: { record: 3 }, alarm: { videoLost: 0 } }),
    })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online' });
    expect(unit.cameraPresent[2]).toBe(true);
    expect(unit).toMatchObject({ activeCameras: 1, overallStatus: 'unknown' });
    const [absent] = buildUnitRows([sourceRow({ gps: true, Camera2: '' })], [], noScope, now);
    expect(absent.cameraPresent[2]).toBe(false);
  });

  it('preserves an installed numeric loss from the sheet when the VSS health payload is absent', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, usableChs: 9, recording: '1, 4', videoloss: '4' })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 4: 'offline' });
    expect(unit.cameraPresent[4]).toBe(true);
    expect(unit).toMatchObject({ activeCameras: 1, overallStatus: 'warning' });
  });

  it('resolves VSS friendly camera names by their actual channel positions before legacy name mapping', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, usableChs: 9, channelname: 'Cabin;;;Front', recording: 'Cabin, Front', videoloss: 'Front',
    })], [], noScope, now);
    expect(unit.cameraChannels).toEqual({ ...unknownCameraChannels, 1: 'online', 4: 'offline' });
    expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => [check.key, check.en, check.status]))
      .toEqual([['c1', 'Cabin', 'online'], ['c4', 'Front', 'offline']]);
    expect(unit).toMatchObject({ activeCameras: 1, overallStatus: 'warning' });
  });

  it('keeps complete valid VSS health masks authoritative over contradictory flattened recording and loss lists', () => {
    const cases: Array<{ record: number; videoLost: number; row: GoogleSheetRow; frontStatus: string; overall: string }> = [
      { record: 9, videoLost: 0, row: { recording: 'NotRecording', videoloss: 'Front' }, frontStatus: 'online', overall: 'healthy' },
      { record: 1, videoLost: 8, row: { recording: 'Cabin, Front', videoloss: 'NA' }, frontStatus: 'offline', overall: 'warning' },
    ];
    for (const { record, videoLost, row, frontStatus, overall } of cases) {
      const [unit] = buildUnitRows([sourceRow({
        gps: true, usableChs: 9, channelname: 'Cabin;;;Front', ...row,
        lastStatusJson: JSON.stringify({ module: { record }, alarm: { videoLost } }),
      })], [], noScope, now);
      expect(unit.cameraChannels[1]).toBe('online');
      expect(unit.cameraChannels[4]).toBe(frontStatus);
      expect(unit.overallStatus).toBe(overall);
    }
  });

  it('does not let a blank Front checklist column hide a separately installed AI camera loss', () => {
    const [unit] = buildUnitRows([sourceRow({
      gps: true, Front: '', usableChs: 5, recording: 'Front, AI', videoloss: 'AI',
    })], [], noScope, now);
    expect(getUnitChecks(unit)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'c3', status: 'offline', present: true }),
    ]));
    expect(unit.statuses.front).toBe('unknown');
    expect(unit).toMatchObject({ cameraSource: 'channels', activeCameras: 1, overallStatus: 'warning' });
  });

  it('does not infer online cameras from a recording mask when a supplied loss mask is malformed', () => {
    for (const videoLost of ['9oops', -1, true]) {
      const [unit] = buildUnitRows([sourceRow({
        gps: true, usableChs: 9, recording: '1, 4',
        lastStatusJson: JSON.stringify({ module: { record: 9 }, alarm: { videoLost } }),
      })], [], noScope, now);
      expect(unit.cameraChannels, String(videoLost)).toEqual(unknownCameraChannels);
      expect(unit).toMatchObject({ activeCameras: 0, overallStatus: 'unknown' });
    }
  });

  it('keeps incomplete installation coverage unknown without inventing failures for unseen cameras', () => {
    const [unit] = buildUnitRows([sourceRow({ gps: true, recording: '1' })], [cameraRow({ CH: 5 })], noScope, now);
    expect(unit).toMatchObject({ expectedCameras: 5, activeCameras: 1, overallStatus: 'unknown' });
    expect(getUnitCameraChecks(unit).filter((check) => check.present).map((check) => check.key)).toEqual(['c1']);
    expect(getUnitChecks(unit).filter((check) => check.status === 'offline')).toEqual([]);
  });

  it('does not turn a CH count into contiguous installation or suppress an observed channel beyond that count', () => {
    const [unobserved] = buildUnitRows([sourceRow({ gps: true })], [cameraRow({ CH: 9 })], noScope, now);
    expect(unobserved.expectedCameras).toBe(9);
    expect(Object.values(unobserved.cameraPresent)).toEqual(Array(9).fill(false));
    const [observed] = buildUnitRows([sourceRow({ gps: true, recording: '9' })], [cameraRow({ CH: 5 })], noScope, now);
    expect(observed.expectedCameras).toBe(5);
    expect(observed.cameraChannels[9]).toBe('online');
    expect(getUnitCameraChecks(observed).filter((check) => check.present).map((check) => check.key)).toEqual(['c9']);
    expect(observed.activeCameras).toBe(1);
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
