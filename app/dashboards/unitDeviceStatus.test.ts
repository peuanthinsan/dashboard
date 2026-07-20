import { describe, expect, it } from 'vitest';
import {
  buildAbnormalDetails,
  deriveUnitDeviceIndicators,
  extractTruckCode,
  formatRelativeUpdated,
  indicatorIsOffline,
  parseCameraStatuses,
  parseGpsOnline,
} from './unitDeviceStatus';

describe('extractTruckCode', () => {
  it('strips plate suffix in parentheses', () => {
    expect(extractTruckCode('R001(64-9396)')).toBe('R001');
    expect(extractTruckCode('T014(65-1443)')).toBe('T014');
  });

  it('returns the raw code when no parentheses', () => {
    expect(extractTruckCode('R001')).toBe('R001');
  });
});

describe('parseGpsOnline', () => {
  it('accepts boolean and common truthy strings', () => {
    expect(parseGpsOnline(true)).toBe(true);
    expect(parseGpsOnline('TRUE')).toBe(true);
    expect(parseGpsOnline('1')).toBe(true);
    expect(parseGpsOnline(false)).toBe(false);
    expect(parseGpsOnline('FALSE')).toBe(false);
    expect(parseGpsOnline(null)).toBe(false);
  });
});

describe('parseCameraStatuses', () => {
  it('handles numbered recording and videoloss', () => {
    const cams = parseCameraStatuses('1, 2, 3, 4, 5', '7, 8');
    expect(cams).toEqual({ 1: 'online', 2: 'online', 3: 'online', 4: 'online', 5: 'online' });
  });

  it('marks videoloss channel offline', () => {
    const cams = parseCameraStatuses('1, 2, 3, 4, 5', '3');
    expect(cams[3]).toBe('offline');
    expect(cams[1]).toBe('online');
  });

  it('marks missing recording channels offline', () => {
    const cams = parseCameraStatuses('1, 2, 3, 4', '5');
    expect(cams[5]).toBe('offline');
    expect(cams[4]).toBe('online');
  });

  it('maps named Howen channels', () => {
    const cams = parseCameraStatuses(
      'Rear Right, Rear Left, AI, Front, Driver',
      'AI',
    );
    expect(cams).toEqual({
      1: 'online',
      2: 'online',
      3: 'offline',
      4: 'online',
      5: 'online',
    });
  });

  it('marks all cameras offline when NotRecording', () => {
    const cams = parseCameraStatuses('NotRecording', 'Rear Right, Rear Left, AI, Front');
    expect(cams).toEqual({
      1: 'offline',
      2: 'offline',
      3: 'offline',
      4: 'offline',
      5: 'offline',
    });
  });

  it('treats None videoloss as no loss', () => {
    const cams = parseCameraStatuses('1, 2, 3, 4, 5', 'None');
    expect(cams[3]).toBe('online');
  });
});

describe('deriveUnitDeviceIndicators', () => {
  it('marks empty vehicle as not_installed', () => {
    const ind = deriveUnitDeviceIndicators({ vehicleNo: '', gps: true });
    expect(ind.overall).toBe('not_installed');
    expect(ind.gps).toBe('not_installed');
  });

  it('follows GPS for MCR/MDVR/IVMS and keeps Intercom always online', () => {
    const online = deriveUnitDeviceIndicators({
      vehicleNo: 'R002',
      gps: true,
      recording: '1, 2, 3, 4, 5',
      videoloss: 'None',
    });
    expect(online.gps).toBe('online');
    expect(online.mcr).toBe('online');
    expect(online.mdvr).toBe('online');
    expect(online.ivms).toBe('online');
    expect(online.intercom).toBe('online');
    expect(online.overall).toBe('healthy');

    const offline = deriveUnitDeviceIndicators({
      vehicleNo: 'R006',
      gps: false,
      recording: 'NotRecording',
      videoloss: '1, 2, 3, 4, 5',
    });
    expect(offline.gps).toBe('offline');
    expect(offline.mcr).toBe('offline');
    expect(offline.mdvr).toBe('offline');
    expect(offline.ivms).toBe('offline');
    expect(offline.intercom).toBe('online');
    expect(offline.overall).toBe('offline');
  });

  it('sets Fatigue AI from Camera 3 and overall Warning when cameras fail', () => {
    const ind = deriveUnitDeviceIndicators({
      vehicleNo: 'R001(64-9396)',
      gps: true,
      recording: 'Rear Right, Rear Left, AI, Front, Driver',
      videoloss: 'AI',
    });
    expect(ind.cameras[3]).toBe('offline');
    expect(ind.fatigueAi).toBe('offline');
    expect(ind.gps).toBe('online');
    expect(ind.intercom).toBe('online');
    expect(ind.overall).toBe('warning');
  });
});

describe('buildAbnormalDetails', () => {
  it('returns Normal when healthy', () => {
    const ind = deriveUnitDeviceIndicators({
      vehicleNo: 'R002',
      gps: true,
      recording: '1, 2, 3, 4, 5',
      videoloss: null,
    });
    expect(buildAbnormalDetails(ind, 'en')).toBe('Normal');
    expect(buildAbnormalDetails(ind, 'th')).toBe('ปกติ');
  });

  it('lists offline cameras and Fatigue AI', () => {
    const ind = deriveUnitDeviceIndicators({
      vehicleNo: 'R001',
      gps: true,
      recording: 'Rear Right, Rear Left, AI, Front, Driver',
      videoloss: 'AI',
    });
    const en = buildAbnormalDetails(ind, 'en');
    expect(en).toContain('Fatigue AI: Offline');
    expect(en).toContain('Camera 3: Offline');
    expect(en).not.toContain('Intercom');
  });
});

describe('indicatorIsOffline', () => {
  it('checks device filter keys', () => {
    const ind = deriveUnitDeviceIndicators({
      vehicleNo: 'R001',
      gps: true,
      recording: '1, 2, 3, 4, 5',
      videoloss: '2',
    });
    expect(indicatorIsOffline(ind, 'c2')).toBe(true);
    expect(indicatorIsOffline(ind, 'c1')).toBe(false);
    expect(indicatorIsOffline(ind, 'intercom')).toBe(false);
  });
});

describe('formatRelativeUpdated', () => {
  it('formats minute/hour relative labels', () => {
    const now = new Date('2026-07-21T04:00:00Z');
    expect(formatRelativeUpdated(new Date('2026-07-21T03:58:00Z'), now, 'en')).toBe('2 min ago');
    expect(formatRelativeUpdated(new Date('2026-07-21T02:00:00Z'), now, 'en')).toBe('2 hr ago');
  });
});
