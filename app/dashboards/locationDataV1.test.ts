import { describe, expect, it } from 'vitest';
import type { GoogleSheetRow } from './googleSheetParse';
import {
  MAX_LOCATION_INTERVAL_MS,
  buildLocationContinuityGroups,
  buildLocationMapHref,
  haversineDistanceKm,
  normalizeLocationRows,
  summarizeLocationRecords,
} from './locationDataV1';

describe('normalizeLocationRows', () => {
  it('normalizes canonical and aliased sheet fields, keeps the source, and sorts newest first', () => {
    const canonicalRow: GoogleSheetRow = {
      'Vehicle No': ' 00-0055 ',
      'Track Time': '15/03/2026 10:00:04',
      Latitude: 13.530125,
      Longitude: 100.6527667,
      'GPS Status': ' A ',
      Location: ' Bang Pu ',
      Speed: 0,
      Ignition: 'OFF',
      'Driver Name': ' Apidet Prayat ',
      'Face ID': null,
      'Polling Mode': 'Normal',
      Fuelbar: 0,
      'Updated Time': '15/03/2026 11:00:18',
    };
    const aliasedRow: GoogleSheetRow = {
      vehicle_no: 'TRUCK-2',
      'GPS Time': '15/03/2026 11:05:06',
      'GPS Latitude': '13.75',
      Lng: '100.5',
      GPS: 'V',
      Address: 'Depot',
      'Speed (km/h)': '58 km/h',
      'ACC Status': true,
      Driver: 'Bob',
      FaceID: 1234,
      PollingMode: 'Rapid',
      'Fuel Level': '72%',
      'Last Updated Time': '15/03/2026 12:05:06',
    };

    const records = normalizeLocationRows([canonicalRow, aliasedRow, {}]);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.vehicleNo)).toEqual(['TRUCK-2', '00-0055']);
    expect(records[0]).toMatchObject({
      sourceIndex: 1,
      sourceRow: aliasedRow,
      latitude: 13.75,
      longitude: 100.5,
      gpsStatus: 'V',
      location: 'Depot',
      speedKph: 58,
      ignition: 'true',
      ignitionOn: true,
      driverName: 'Bob',
      faceId: '1234',
      pollingMode: 'Rapid',
      fuelbar: 72,
      updatedTimeRaw: '15/03/2026 12:05:06',
      mapHref: 'https://www.google.com/maps/search/?api=1&query=13.75%2C100.5',
    });
    expect(records[0]!.trackTime?.toISOString()).toBe('2026-03-15T11:05:06.000Z');
    expect(records[1]).toMatchObject({
      sourceIndex: 0,
      sourceRow: canonicalRow,
      vehicleNo: '00-0055',
      speedKph: 0,
      ignitionOn: false,
      fuelbar: 0,
    });
  });

  it('keeps malformed cells visible while rejecting unsafe parsed values and map links', () => {
    const [record] = normalizeLocationRows([
      {
        'Vehicle No': 'BAD-DATA',
        'Track Time': 'not a date',
        Latitude: '91.1',
        Longitude: '-181',
        Speed: '-5',
        Ignition: 'unknown',
        Fuelbar: 'not measured',
      },
    ]);

    expect(record).toMatchObject({
      vehicleNo: 'BAD-DATA',
      trackTimeRaw: 'not a date',
      trackTime: null,
      latitude: null,
      longitude: null,
      speedKph: null,
      ignitionOn: null,
      fuelbar: null,
      mapHref: null,
    });
  });

  it('uses source order as a stable tie-breaker and leaves undated rows last', () => {
    const records = normalizeLocationRows([
      { 'Vehicle No': 'FIRST', 'Track Time': '15/03/2026 10:00:00' },
      { 'Vehicle No': 'UNDATED', 'Updated Time': '15/03/2026 12:00:00' },
      { 'Vehicle No': 'SECOND', 'Track Time': '15/03/2026 10:00:00' },
    ]);

    expect(records.map((record) => record.vehicleNo)).toEqual(['FIRST', 'SECOND', 'UNDATED']);
  });
});

describe('map and distance helpers', () => {
  it('builds links only for finite in-range coordinates', () => {
    expect(buildLocationMapHref({ latitude: 13.5, longitude: 100.6 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=13.5%2C100.6',
    );
    expect(buildLocationMapHref({ latitude: null, longitude: 100.6 })).toBeNull();
    expect(buildLocationMapHref({ latitude: 100, longitude: 100.6 })).toBeNull();
    expect(buildLocationMapHref({ latitude: 13.5, longitude: Number.NaN })).toBeNull();
  });

  it('computes the Haversine distance and rejects invalid coordinate pairs', () => {
    expect(
      haversineDistanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(111.195, 3);
    expect(
      haversineDistanceKm(
        { latitude: null, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeNull();
    expect(
      haversineDistanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: -91, longitude: 1 },
      ),
    ).toBeNull();
  });

  it('segments routes by vehicle, filtered gaps, outages, and impossible jumps', () => {
    const records = normalizeLocationRows([
      { 'Vehicle No': 'V1', 'Track Time': '15/03/2026 10:00:00', Latitude: 0, Longitude: 0 },
      { 'Vehicle No': 'V2', 'Track Time': '15/03/2026 10:00:30', Latitude: 10, Longitude: 10 },
      { 'Vehicle No': 'V1', 'Track Time': '15/03/2026 10:01:00', Latitude: 0, Longitude: 0.001 },
      { 'Vehicle No': 'V1', 'Track Time': '15/03/2026 10:02:00', Latitude: 0, Longitude: 0.002 },
      { 'Vehicle No': 'V1', 'Track Time': '15/03/2026 11:00:00', Latitude: 0, Longitude: 0.003 },
      { 'Vehicle No': 'V1', 'Track Time': '15/03/2026 11:01:00', Latitude: 10, Longitude: 10 },
    ]);
    const visible = records.filter((record) => record.trackTimeRaw !== '15/03/2026 10:01:00');

    const groups = buildLocationContinuityGroups(records, visible, 'route');

    const byTime = new Map(
      visible.map((record) => [record.trackTimeRaw, groups.get(record.sourceIndex)]),
    );
    expect(byTime.get('15/03/2026 10:00:00')).not.toBe(byTime.get('15/03/2026 10:02:00'));
    expect(byTime.get('15/03/2026 10:02:00')).not.toBe(byTime.get('15/03/2026 11:00:00'));
    expect(byTime.get('15/03/2026 11:00:00')).not.toBe(byTime.get('15/03/2026 11:01:00'));
    expect(byTime.get('15/03/2026 10:00:00')).not.toBe(byTime.get('15/03/2026 10:00:30'));
  });

  it('uses Updated Time when Track Time is unavailable for visual continuity', () => {
    const records = normalizeLocationRows([
      { 'Vehicle No': 'V1', 'Updated Time': '15/03/2026 10:00:00', Latitude: 0, Longitude: 0 },
      { 'Vehicle No': 'V1', 'Updated Time': '15/03/2026 10:01:00', Latitude: 0, Longitude: 0.001 },
    ]);

    const groups = buildLocationContinuityGroups(records, records, 'route');

    expect(groups.get(records[0]!.sourceIndex)).toBe(groups.get(records[1]!.sourceIndex));
  });
});

describe('summarizeLocationRecords', () => {
  it('computes counts, speed metrics, sampled durations, and per-vehicle distance', () => {
    const records = normalizeLocationRows([
      {
        'Vehicle No': 'V1',
        'Track Time': '15/03/2026 10:00:00',
        Latitude: 0,
        Longitude: 0,
        Speed: 60,
        Ignition: 'ON',
        'Driver Name': 'Alice',
        Location: 'Depot',
      },
      {
        'Vehicle No': 'V1',
        'Track Time': '15/03/2026 10:01:00',
        Latitude: 0,
        Longitude: 0.01,
        Speed: 30,
        Ignition: 'ON',
        'Driver Name': 'Alice',
        Location: 'Road',
      },
      {
        'Vehicle No': 'V1',
        'Track Time': '15/03/2026 10:02:00',
        Latitude: 0,
        Longitude: 0.02,
        Speed: 0,
        Ignition: 'OFF',
        'Driver Name': ' Alice ',
        Location: 'ROAD',
      },
      {
        'Vehicle No': 'V2',
        'Track Time': '15/03/2026 10:00:00',
        Latitude: 10,
        Longitude: 10,
        Speed: 0,
        Ignition: 'OFF',
        'Driver Name': 'Bob',
        Location: ' depot ',
      },
      {
        'Vehicle No': 'v2',
        'Track Time': '15/03/2026 10:02:00',
        Latitude: 10,
        Longitude: 10.01,
        Speed: 10,
        Ignition: 'ON',
        'Driver Name': 'bob',
        Location: '',
      },
    ]);

    const summary = summarizeLocationRecords(records);

    expect(summary).toMatchObject({
      recordCount: 5,
      uniqueVehicleCount: 2,
      uniqueDriverCount: 2,
      uniqueLocationCount: 2,
      maxSpeedKph: 60,
      averageSpeedKph: 20,
      movingRecordCount: 3,
      movingDurationMs: 2 * 60_000,
      ignitionOnDurationMs: 2 * 60_000,
      trackedDurationMs: 4 * 60_000,
    });
    expect(summary.totalDistanceKm).toBeCloseTo(3.319, 2);
  });

  it('does not join vehicles or count outages, invalid points, or impossible jumps as distance', () => {
    const records = normalizeLocationRows([
      {
        'Vehicle No': 'GAP',
        'Track Time': '15/03/2026 09:00:00',
        Latitude: 0,
        Longitude: 0,
        Speed: 20,
        Ignition: 'ON',
      },
      {
        'Vehicle No': 'GAP',
        'Track Time': `15/03/2026 09:${String(MAX_LOCATION_INTERVAL_MS / 60_000 + 1).padStart(2, '0')}:00`,
        Latitude: 0,
        Longitude: 0.01,
        Speed: 20,
        Ignition: 'ON',
      },
      {
        'Vehicle No': 'JUMP',
        'Track Time': '15/03/2026 10:00:00',
        Latitude: 0,
        Longitude: 0,
        Speed: 10,
        Ignition: 'ON',
      },
      {
        'Vehicle No': 'JUMP',
        'Track Time': '15/03/2026 10:01:00',
        Latitude: 10,
        Longitude: 10,
        Speed: 10,
        Ignition: 'ON',
      },
      {
        'Vehicle No': 'INVALID',
        'Track Time': '15/03/2026 11:00:00',
        Latitude: 91,
        Longitude: 10,
        Speed: 0,
        Ignition: 'OFF',
      },
      {
        'Vehicle No': 'INVALID',
        'Track Time': '15/03/2026 11:01:00',
        Latitude: 10,
        Longitude: 10.01,
        Speed: 0,
        Ignition: 'OFF',
      },
      {
        'Vehicle No': '',
        'Track Time': '15/03/2026 12:00:00',
        Latitude: 0,
        Longitude: 0,
        Speed: 50,
        Ignition: 'ON',
      },
      {
        'Vehicle No': '',
        'Track Time': '15/03/2026 12:01:00',
        Latitude: 0,
        Longitude: 0.01,
        Speed: 50,
        Ignition: 'ON',
      },
    ]);

    const summary = summarizeLocationRecords(records);

    // The valid-time JUMP and INVALID intervals still represent two tracked minutes;
    // only their distance is rejected. The long GAP and anonymous rows are disconnected.
    expect(summary.trackedDurationMs).toBe(2 * 60_000);
    expect(summary.movingDurationMs).toBe(60_000);
    expect(summary.ignitionOnDurationMs).toBe(60_000);
    expect(summary.totalDistanceKm).toBe(0);
  });

  it('does not join samples across records removed by UI filters', () => {
    const allRecords = normalizeLocationRows([
      {
        'Vehicle No': 'V1',
        'Track Time': '15/03/2026 10:00:00',
        Latitude: 0,
        Longitude: 0,
        Speed: 20,
        Ignition: 'ON',
      },
      {
        'Vehicle No': 'V1',
        'Track Time': '15/03/2026 10:01:00',
        Latitude: 0,
        Longitude: 0.01,
        Speed: 0,
        Ignition: 'OFF',
      },
      {
        'Vehicle No': 'V1',
        'Track Time': '15/03/2026 10:02:00',
        Latitude: 0,
        Longitude: 0.02,
        Speed: 20,
        Ignition: 'ON',
      },
    ]);
    const filteredRecords = allRecords.filter((record) => record.speedKph === 20);

    const summary = summarizeLocationRecords(filteredRecords, allRecords);

    expect(summary).toMatchObject({
      recordCount: 2,
      movingRecordCount: 2,
      trackedDurationMs: 0,
      movingDurationMs: 0,
      ignitionOnDurationMs: 0,
      totalDistanceKm: 0,
    });
  });

  it('returns zero-valued metrics for no records or usable speed samples', () => {
    expect(summarizeLocationRecords([])).toEqual({
      recordCount: 0,
      uniqueVehicleCount: 0,
      uniqueDriverCount: 0,
      uniqueLocationCount: 0,
      maxSpeedKph: 0,
      averageSpeedKph: 0,
      movingRecordCount: 0,
      movingDurationMs: 0,
      ignitionOnDurationMs: 0,
      trackedDurationMs: 0,
      totalDistanceKm: 0,
    });

    const records = normalizeLocationRows([
      { 'Vehicle No': 'V1', Speed: 'not measured' },
      { 'Vehicle No': 'V2', Speed: -1 },
    ]);
    expect(summarizeLocationRecords(records)).toMatchObject({
      maxSpeedKph: 0,
      averageSpeedKph: 0,
      movingRecordCount: 0,
    });
  });
});
