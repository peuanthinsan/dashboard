import { describe, expect, it } from 'vitest';
import type { GoogleSheetRow } from './googleSheetParse';
import { detectFuelIncreases, formatFuelTime, parseFuelRows } from './fuelData';

const row = (date: string, fuel: GoogleSheetRow[string], overrides: GoogleSheetRow = {}): GoogleSheetRow => ({
  'Vehicle No': 'BGT-1', 'Date Time': date, 'Total Fuel': fuel,
  Speed: 0, Ignition: 'OFF', Location: 'Depot', ...overrides,
});
const time = (minute: string) => `24/09/2026 0:${minute}:00`;

describe('parseFuelRows', () => {
  it('matches every used header without case or surrounding-space sensitivity and retains source', () => {
    const source = {
      ' vehicle NO ': 'BGT-2', ' DATE time ': '24/09/2026 0:45:38', 'total FUEL ': '25.5',
      ' sPEED ': '0', ' ignition': 'ON', 'Location ': 'Depot B',
    };
    const result = parseFuelRows([source]);
    expect(result.invalidRows).toBe(0);
    expect(result.readings[0]).toMatchObject({
      vehicle: 'BGT-2', timestamp: Date.UTC(2026, 8, 24, 0, 45, 38),
      fuel: 25.5, speed: 0, ignition: 'ON', location: 'Depot B',
    });
    expect(result.readings[0].source).toBe(source);
    expect(source['total FUEL ']).toBe('25.5');
  });

  it('sorts reverse source order and treats source times as Bangkok wall-clock digits', () => {
    const result = parseFuelRows([row('24/09/2026 14:48:07', 12), row('24/09/2026 0:45:38', 10)]);
    expect(result.readings.map((reading) => reading.timestamp)).toEqual([
      Date.UTC(2026, 8, 24, 0, 45, 38), Date.UTC(2026, 8, 24, 14, 48, 7),
    ]);
    expect(result.readings[0].day).toBe('2026-09-24');
    expect(formatFuelTime(result.readings[0].timestamp, true)).toBe('24/09/2026, 00:45:38');
  });

  it('supports validated GViz and ISO date digits without local timezone parsing', () => {
    const values = ['Date(2026,8,24,0,45,38)', '2026-09-24T00:45:38', '2026-09-24 00:45:38Z'];
    for (const value of values) {
      expect(parseFuelRows([row(value, 10)]).readings[0].timestamp).toBe(Date.UTC(2026, 8, 24, 0, 45, 38));
    }
    expect(parseFuelRows([row('Date(2026,8,24)', 10)]).readings[0].timestamp).toBe(Date.UTC(2026, 8, 24));
    expect(parseFuelRows([row('2026-09-24T00:45:38.1', 10)]).readings[0].timestamp).toBe(Date.UTC(2026, 8, 24, 0, 45, 38, 100));
  });

  it('rejects ambiguous, impossible and normalized-overflow dates', () => {
    const bad = ['9/24/2026 0:45:38', '31/09/2026 0:45:38', '29/02/2025 0:45:38', '24/09/2026 24:00:00', '24/09/2026 0:60:00', 'Date(2026,12,24)', '2026-02-30T00:45:38', '2026-09-24', 'junk'];
    const result = parseFuelRows(bad.map((value) => row(value, 10)));
    expect(result.invalidRows).toBe(bad.length);
    expect(result.readings).toEqual([]);
    expect(parseFuelRows([row('29/02/2024 0:45:38', 10)]).invalidRows).toBe(0);
  });

  it('preserves zero, accepts well-formed comma numbers and rejects junk', () => {
    const values: GoogleSheetRow[string][] = [0, '0', '1,234.50', '.5', '', null, false, '10 L', '1,23', '-1', -1, Infinity, '1e3'];
    const result = parseFuelRows(values.map((fuel, i) => row(time(String(i).padStart(2, '0')), fuel, { Speed: fuel })));
    expect(result.readings.map((reading) => reading.fuel)).toEqual([0, 0, 1234.5, 0.5, null, null, null, null, null, null, null, null, null]);
    expect(result.readings.map((reading) => reading.speed)).toEqual(result.readings.map((reading) => reading.fuel));
    expect(result.invalidRows).toBe(0);
  });

  it('deduplicates consistent readings while preserving original source records', () => {
    const source = row(time('00'), '10', { SlNo: 1 });
    const result = parseFuelRows([source, row(time('00'), 10, { SlNo: 2 }), row(time('01'), 15)]);
    expect(result.duplicateRows).toBe(1);
    expect(result.conflictingRows).toBe(0);
    expect(result.readings).toHaveLength(2);
    expect(result.readings[0].source).toBe(source);
    expect(detectFuelIncreases(result.readings, 5)).toHaveLength(1);
  });

  it('retains conflicting timestamp records with null fuel barriers and counts each once', () => {
    const source = row(time('01'), 12);
    const result = parseFuelRows([row(time('00'), 10), source, row(time('01'), 14), row(time('01'), 14), row(time('02'), 20)]);
    expect(result.duplicateRows).toBe(1);
    expect(result.conflictingRows).toBe(2);
    expect(result.readings.map((reading) => reading.fuel)).toEqual([10, null, null, 20]);
    expect(source['Total Fuel']).toBe(12);
    expect(detectFuelIncreases(result.readings, 1)).toEqual([]);
  });

  it('suppresses a vehicle with unplaceable dates while retaining levels and other vehicles', () => {
    const result = parseFuelRows([
      row(time('00'), 10), row('bad date', 20), row(time('01'), 30),
      row(time('00'), 1, { 'Vehicle No': 'BGT-2' }), row(time('01'), 8, { 'Vehicle No': 'BGT-2' }),
      row(time('02'), 1, { 'Vehicle No': '' }),
    ]);
    expect(result.invalidRows).toBe(2);
    expect(result.readings.filter((reading) => reading.vehicle === 'BGT-1').map((reading) => [reading.fuel, reading.continuityBlocked])).toEqual([[10, true], [30, true]]);
    expect(detectFuelIncreases(result.readings, 5).map((event) => event.vehicle)).toEqual(['BGT-2']);
  });
});

describe('detectFuelIncreases', () => {
  it('compares consecutive readings per vehicle, never crossing vehicle boundaries', () => {
    const { readings } = parseFuelRows([
      row(time('00'), 10), row(time('01'), 100, { 'Vehicle No': 'BGT-2' }),
      row(time('02'), 15), row(time('03'), 101, { 'Vehicle No': 'BGT-2' }),
    ]);
    const events = detectFuelIncreases([...readings].reverse(), 5);
    expect(events.map((event) => [event.vehicle, event.amount, event.gapMinutes])).toEqual([['BGT-1', 5, 2]]);
  });

  it('includes an exact positive threshold and excludes drops, flat levels and smaller rises', () => {
    const { readings } = parseFuelRows([row(time('00'), 10), row(time('01'), 10), row(time('02'), 8), row(time('03'), 10), row(time('04'), 15)]);
    expect(detectFuelIncreases(readings, 5).map((event) => event.amount)).toEqual([5]);
    expect(detectFuelIncreases(readings, 0).map((event) => event.amount)).toEqual([2, 5]);
  });

  it('includes a decimal change equal to the threshold despite binary rounding', () => {
    const { readings } = parseFuelRows([row(time('00'), 0.2), row(time('01'), 0.3)]);
    expect(detectFuelIncreases(readings, 0.1)).toHaveLength(1);
    expect(detectFuelIncreases(readings, 0.1001)).toEqual([]);
  });

  it('never detects an increase with zero elapsed time', () => {
    const { readings } = parseFuelRows([row(time('00'), 10)]);
    expect(detectFuelIncreases([readings[0], { ...readings[0], id: 'simultaneous', fuel: 20 }], 5)).toEqual([]);
  });

  it('requires explicit zero at both endpoints to mark a change stationary', () => {
    const { readings } = parseFuelRows([
      row(time('00'), 0), row(time('01'), 5), row(time('02'), 10, { Speed: null }),
      row(time('03'), 15), row(time('04'), 20, { Speed: 2 }),
    ]);
    expect(detectFuelIncreases(readings, 5).map((event) => event.stationary)).toEqual([true, false, false, false]);
  });

  it('does not bridge missing fuel and resumes only with a new valid pair', () => {
    const { readings } = parseFuelRows([row(time('00'), 0), row(time('01'), null), row(time('02'), 20), row(time('03'), 25)]);
    expect(detectFuelIncreases(readings, 1).map((event) => event.amount)).toEqual([5]);
  });

  it('includes the gap cutoff but excludes larger gaps and invalid controls', () => {
    const { readings } = parseFuelRows([row(time('00'), 10), row(time('10'), 15), row(time('21'), 20)]);
    expect(detectFuelIncreases(readings, 5).map((event) => event.gapMinutes)).toEqual([10]);
    expect(detectFuelIncreases(readings, 5, 9)).toEqual([]);
    for (const minimum of [-1, Infinity, NaN]) expect(detectFuelIncreases(readings, minimum)).toEqual([]);
    for (const gap of [0, -1, Infinity, NaN]) expect(detectFuelIncreases(readings, 5, gap)).toEqual([]);
  });

  it('keeps a real pair across midnight when event-date filtering follows detection', () => {
    const { readings } = parseFuelRows([row('23/09/2026 23:59:00', 10), row('24/09/2026 0:01:00', 20)]);
    const events = detectFuelIncreases(readings, 5).filter((event) => event.after.day === '2026-09-24');
    expect(events).toHaveLength(1);
    expect(events[0].before.day).toBe('2026-09-23');
    expect(events[0].gapMinutes).toBe(2);
  });
});
