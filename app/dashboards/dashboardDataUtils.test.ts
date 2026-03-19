import { describe, it, expect } from 'vitest';
import {
  normalizeLabel,
  findValue,
  toDisplayString,
  hasRemark,
  isExcludedAlertRemark,
  parseDate,
  resolveTemplate,
} from './dashboardDataUtils';

describe('dashboardDataUtils', () => {
  describe('normalizeLabel', () => {
    it('trims and lowercases', () => {
      expect(normalizeLabel('  Driver Name  ')).toBe('driver name');
      expect(normalizeLabel('Vehicle No')).toBe('vehicle no');
    });
  });

  describe('findValue', () => {
    it('finds value by exact label', () => {
      const row = { 'Driver Name': 'John', 'Vehicle No': 'V001' };
      expect(findValue(row, ['Driver Name'])).toBe('John');
      expect(findValue(row, ['Vehicle No'])).toBe('V001');
    });

    it('finds value by alternate labels', () => {
      const row = { 'Vehicle No TH': 'กข 1234' };
      expect(findValue(row, ['Vehicle No', 'Vehicle No TH'])).toBe('กข 1234');
    });

    it('returns null when not found', () => {
      const row = { foo: 'bar' };
      expect(findValue(row, ['Missing'])).toBeNull();
    });
  });

  describe('toDisplayString', () => {
    it('returns em dash for null/empty', () => {
      expect(toDisplayString(null)).toBe('—');
      expect(toDisplayString('')).toBe('—');
    });
    it('converts value to string', () => {
      expect(toDisplayString(42)).toBe('42');
      expect(toDisplayString('Hello')).toBe('Hello');
    });
  });

  describe('hasRemark', () => {
    it('returns false for em dash or empty', () => {
      expect(hasRemark('—')).toBe(false);
      expect(hasRemark('')).toBe(false);
      expect(hasRemark('   ')).toBe(false);
    });
    it('returns true for non-empty content', () => {
      expect(hasRemark('Some note')).toBe(true);
    });
  });

  describe('isExcludedAlertRemark', () => {
    it('identifies false alert', () => {
      expect(isExcludedAlertRemark('False alert - test')).toBe(true);
      expect(isExcludedAlertRemark('FALSE ALERT')).toBe(true);
    });
    it('identifies no video', () => {
      expect(isExcludedAlertRemark('No video available')).toBe(true);
      expect(isExcludedAlertRemark('no-video')).toBe(true);
    });
    it('returns false for normal remarks', () => {
      expect(isExcludedAlertRemark('Speeding')).toBe(false);
      expect(isExcludedAlertRemark('—')).toBe(false);
    });
  });

  describe('parseDate', () => {
    it('parses DD/MM/YYYY', () => {
      const d = parseDate('15/3/2024');
      expect(d).toBeInstanceOf(Date);
      expect(d!.getDate()).toBe(15);
      expect(d!.getMonth()).toBe(2);
      expect(d!.getFullYear()).toBe(2024);
    });
    it('parses DD/MM/YYYY HH:MM:SS', () => {
      const d = parseDate('15/3/2024 14:30:00');
      expect(d).toBeInstanceOf(Date);
      expect(d!.getHours()).toBe(14);
      expect(d!.getMinutes()).toBe(30);
    });
    it('returns null for invalid input', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('invalid')).toBeNull();
    });
  });

  describe('resolveTemplate', () => {
    it('resolves Video to Detail', () => {
      expect(resolveTemplate('Video')).toBe('Detail');
    });
    it('passes through other templates', () => {
      expect(resolveTemplate('Summary')).toBe('Summary');
      expect(resolveTemplate('Detail')).toBe('Detail');
      expect(resolveTemplate('Simple')).toBe('Simple');
      expect(resolveTemplate('Driving')).toBe('Driving');
    });
  });
});
