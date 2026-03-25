import { describe, it, expect } from 'vitest';
import { shouldUseSavedColumnPrefs } from './csvExportSchema';

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
