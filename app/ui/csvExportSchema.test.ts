import { describe, it, expect } from 'vitest';
import { moveColumn, moveColumnTo, placeDriverNameBeforeId, shouldUseSavedColumnPrefs } from './csvExportSchema';

describe('shouldUseSavedColumnPrefs', () => {
  const schema = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

  it('returns false when saved is null or empty', () => {
    expect(shouldUseSavedColumnPrefs(null, schema)).toBe(false);
    expect(shouldUseSavedColumnPrefs(undefined, schema)).toBe(false);
    expect(shouldUseSavedColumnPrefs([], schema)).toBe(false);
  });

  it('returns true when saved keys match schema keys exactly', () => {
    const saved = [
      { key: 'a', enabled: true, label: 'A' },
      { key: 'b', enabled: false, label: 'B' },
      { key: 'c', enabled: true, label: 'C' },
    ];
    expect(shouldUseSavedColumnPrefs(saved, schema)).toBe(true);
  });

  it('returns false when schema gained a column', () => {
    const saved = [
      { key: 'a', enabled: true, label: 'A' },
      { key: 'b', enabled: true, label: 'B' },
    ];
    expect(shouldUseSavedColumnPrefs(saved, schema)).toBe(false);
  });

  it('returns false when schema lost a column', () => {
    const saved = [
      { key: 'a', enabled: true, label: 'A' },
      { key: 'b', enabled: true, label: 'B' },
      { key: 'c', enabled: true, label: 'C' },
      { key: 'd', enabled: true, label: 'D' },
    ];
    expect(shouldUseSavedColumnPrefs(saved, schema)).toBe(false);
  });

  it('returns false when a key was renamed (sheet layout change)', () => {
    const saved = [
      { key: 'old', enabled: true, label: 'Old' },
      { key: 'b', enabled: true, label: 'B' },
      { key: 'c', enabled: true, label: 'C' },
    ];
    expect(shouldUseSavedColumnPrefs(saved, schema)).toBe(false);
  });

  it('returns true regardless of saved order vs schema order', () => {
    const saved = [
      { key: 'c', enabled: true, label: 'C' },
      { key: 'a', enabled: true, label: 'A' },
      { key: 'b', enabled: true, label: 'B' },
    ];
    expect(shouldUseSavedColumnPrefs(saved, schema)).toBe(true);
  });
});

describe('placeDriverNameBeforeId', () => {
  it('moves Driver Name immediately before id while preserving the other columns', () => {
    const schema = [
      { key: 'id', label: 'id' },
      { key: 'vehicle', label: 'Vehicle No' },
      { key: 'driver', label: 'Driver Name' },
      { key: 'alert', label: 'Alert Type' },
    ];

    expect(placeDriverNameBeforeId(schema).map((column) => column.label)).toEqual([
      'Driver Name',
      'id',
      'Vehicle No',
      'Alert Type',
    ]);
  });

  it('leaves schemas without both columns unchanged', () => {
    const schema = [{ key: 'id', label: 'id' }, { key: 'vehicle', label: 'Vehicle No' }];
    expect(placeDriverNameBeforeId(schema)).toBe(schema);
  });
});

describe('moveColumn', () => {
  it('moves a column up or down', () => {
    expect(moveColumn(['id', 'driver', 'vehicle'], 1, -1)).toEqual(['driver', 'id', 'vehicle']);
    expect(moveColumn(['id', 'driver', 'vehicle'], 1, 1)).toEqual(['id', 'vehicle', 'driver']);
  });

  it('leaves boundary moves unchanged', () => {
    const columns = ['id', 'driver'];
    expect(moveColumn(columns, 0, -1)).toBe(columns);
    expect(moveColumn(columns, 1, 1)).toBe(columns);
  });
});

describe('moveColumnTo', () => {
  it('moves a dragged column to the dropped column position', () => {
    expect(moveColumnTo(['id', 'driver', 'vehicle'], 0, 2)).toEqual(['driver', 'vehicle', 'id']);
    expect(moveColumnTo(['id', 'driver', 'vehicle'], 2, 0)).toEqual(['vehicle', 'id', 'driver']);
  });

  it('leaves invalid or same-position moves unchanged', () => {
    const columns = ['id', 'driver'];
    expect(moveColumnTo(columns, 0, 0)).toBe(columns);
    expect(moveColumnTo(columns, -1, 0)).toBe(columns);
  });
});
