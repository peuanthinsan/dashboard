import { describe, expect, it } from 'vitest';
import { resolveTemplate } from './dashboardDataUtils';
import {
  aggregateVehicleKpi,
  categorizeRow,
  gradeForCount,
} from './vehicleKpiUtils';

describe('vehicleKpiUtils', () => {
  describe('gradeForCount', () => {
    it.each([
      [0, 'A'],
      [1, 'B'],
      [5, 'B'],
      [6, 'C'],
      [10, 'C'],
      [11, 'D'],
      [20, 'D'],
      [21, 'F'],
      [100, 'F'],
    ] as const)('grades %i incidents as %s', (count, grade) => {
      expect(gradeForCount(count)).toBe(grade);
    });
  });

  describe('categorizeRow', () => {
    it('classifies alert-type-driven categories', () => {
      expect(categorizeRow('OverSpeed', null)).toBe('speeding');
      expect(categorizeRow('Harsh Brake', null)).toBe('harsh');
      expect(categorizeRow('Harsh Acceleration', null)).toBe('harsh');
      expect(categorizeRow('No Seatbelt', null)).toBe('seatbelt');
    });

    it('counts a forward collision with a blank remark', () => {
      expect(categorizeRow('Forward Collision-A2', '')).toBe('forward');
    });

    it('uses Mobile Phone remarks for the phone category', () => {
      expect(categorizeRow('Eye Closing-A2', 'Mobile Phone')).toBe('phone');
    });

    it('excludes false alerts before categorization', () => {
      expect(categorizeRow('OverSpeed', 'false alert')).toBeNull();
    });

    it('returns null for an unknown category', () => {
      expect(categorizeRow('Eye Closing-A2', 'Fatigue')).toBeNull();
    });
  });

  describe('aggregateVehicleKpi', () => {
    it('counts mixed KPI rows per normalized vehicle and preserves zero categories', () => {
      const aggregated = aggregateVehicleKpi([
        { vehicle: 'ABC-123', fleet: 'Fleet A', alertType: 'OverSpeed', remark: null },
        { vehicle: ' abc-123 ', fleet: 'Fleet A', alertType: 'Harsh Brake', remark: null },
        { vehicle: 'ABC-123', fleet: 'Fleet A', alertType: 'Forward Collision-A2', remark: '' },
        { vehicle: 'ABC-123', fleet: 'Fleet A', alertType: 'OverSpeed', remark: 'False alert' },
        { vehicle: 'XYZ-789', fleet: '', alertType: 'Eye Closing-A2', remark: 'Mobile Phone' },
        { vehicle: 'XYZ-789', fleet: 'Fleet B', alertType: 'Eye Closing-A2', remark: 'Fatigue' },
      ]);

      expect(aggregated.size).toBe(2);
      expect(aggregated.get('abc-123')).toEqual({
        vehicle: 'ABC-123',
        fleet: 'Fleet A',
        counts: {
          speeding: 1,
          seatbelt: 0,
          harsh: 1,
          phone: 0,
          forward: 1,
        },
      });
      expect(aggregated.get('xyz-789')).toEqual({
        vehicle: 'XYZ-789',
        fleet: 'Fleet B',
        counts: {
          speeding: 0,
          seatbelt: 0,
          harsh: 0,
          phone: 1,
          forward: 0,
        },
      });
    });
  });

  describe('resolveTemplate', () => {
    it('canonicalizes VehicleKPI spellings', () => {
      expect(resolveTemplate('VehicleKPI')).toBe('VehicleKPI');
      expect(resolveTemplate('vehicle kpi')).toBe('VehicleKPI');
      expect(resolveTemplate('vehiclekpi')).toBe('VehicleKPI');
    });
  });
});
