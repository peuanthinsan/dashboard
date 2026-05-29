import { describe, expect, it } from 'vitest';
import { formatDurationDisplay, hoursToHms, isDurationColumnLabel, normalizeHmsDisplay } from './drivingDurationFormat';

describe('drivingDurationFormat', () => {
  it('formats decimal hours as H:MM:SS', () => {
    expect(hoursToHms(1.5)).toBe('1:30:00');
    expect(hoursToHms(0)).toBe('0:00:00');
    expect(formatDurationDisplay(null, 4.25)).toBe('4:15:00');
  });

  it('preserves spreadsheet H:MM:SS values', () => {
    expect(formatDurationDisplay('4:30:15')).toBe('4:30:15');
    expect(normalizeHmsDisplay('4:5:3')).toBe('4:05:03');
  });

  it('recognizes duration column labels from the driving sheet', () => {
    expect(isDurationColumnLabel('DriveHrs')).toBe(true);
    expect(isDurationColumnLabel('Rest Time')).toBe(true);
    expect(isDurationColumnLabel('Cnt Drv Hr')).toBe(true);
    expect(isDurationColumnLabel('Driver Name')).toBe(false);
  });
});
