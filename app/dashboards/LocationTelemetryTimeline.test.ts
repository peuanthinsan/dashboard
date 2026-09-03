import { describe, expect, it } from 'vitest';
import {
  resolveTelemetryVehicleScope,
  type TelemetryPoint,
} from './LocationTelemetryTimeline';

function point(id: number, vehicleNo: string): TelemetryPoint {
  return {
    id,
    segmentKey: `${vehicleNo || 'anonymous'}:1`,
    vehicleNo,
    timestamp: Date.UTC(2026, 8, 1, 8, id),
    speed: id * 10,
    ignitionOn: true,
  };
}

describe('resolveTelemetryVehicleScope', () => {
  it('allows a timeline when every point belongs to one identified vehicle', () => {
    expect(resolveTelemetryVehicleScope([
      point(1, 'TRUCK-01'),
      point(2, 'TRUCK-01'),
    ])).toEqual({
      vehicleNo: 'TRUCK-01',
      vehicleOptions: ['TRUCK-01'],
      vehicleCount: 1,
      hasUnidentifiedVehicle: false,
    });
  });

  it('requires a vehicle selection instead of combining multiple vehicles', () => {
    expect(resolveTelemetryVehicleScope([
      point(1, 'TRUCK-02'),
      point(2, 'TRUCK-01'),
      point(3, 'TRUCK-02'),
    ])).toEqual({
      vehicleNo: null,
      vehicleOptions: ['TRUCK-01', 'TRUCK-02'],
      vehicleCount: 2,
      hasUnidentifiedVehicle: false,
    });
  });

  it('does not treat unidentified telemetry as a safe single-vehicle trace', () => {
    expect(resolveTelemetryVehicleScope([
      point(1, ''),
      point(2, ''),
    ])).toEqual({
      vehicleNo: null,
      vehicleOptions: [],
      vehicleCount: 1,
      hasUnidentifiedVehicle: true,
    });
  });
});
