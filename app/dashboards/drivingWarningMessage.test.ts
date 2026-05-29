import { describe, expect, it } from 'vitest';
import {
  buildDriveHoursMessageThai,
  buildDriveHoursMessageEnglish,
  buildRestHoursMessageThai,
  buildRestHoursMessageEnglish,
} from './drivingWarningMessage';

describe('Drive Hours message templates', () => {
  const args = {
    driver: 'Annual Natsamrong',
    vehicle: '72-1281(DMS)',
    threshold: 10,
    valueHours: 12.4,
    loginAt: '2026-05-01T04:14:00Z',
    logoutAt: '2026-05-01T13:25:00Z',
    loginLocation: 'Thongfleet',
    logoutLocation: 'THONG TRANSPORT',
    distanceKm: 142.6,
    operatorNote: 'please follow up',
    dashboardName: 'ThongTrans / Bangkok',
  };

  it('Thai includes header, DriveHrs, and dashboard name', () => {
    const out = buildDriveHoursMessageThai(args);
    expect(out).toContain('⚠ ขับรถเกิน 10:00:00 ต่อทริป');
    expect(out).toContain('คนขับ: Annual Natsamrong');
    expect(out).toContain('รถ: 72-1281(DMS)');
    expect(out).toContain('DriveHrs:');
    expect(out).toContain('Distance: 142.6 กม.');
    expect(out).toContain('หมายเหตุ: please follow up');
    expect(out).toContain('— แดชบอร์ด ThongTrans / Bangkok');
  });

  it('English mirror of the Thai template', () => {
    const out = buildDriveHoursMessageEnglish(args);
    expect(out).toContain('DriveHrs > 10:00:00 per trip');
    expect(out).toContain('Driver: Annual Natsamrong');
    expect(out).toContain('Vehicle: 72-1281(DMS)');
    expect(out).toContain('Note: please follow up');
    expect(out).toContain('— Dashboard ThongTrans / Bangkok');
  });

  it('omits the note line when operatorNote is empty/undefined', () => {
    const noNote = buildDriveHoursMessageThai({ ...args, operatorNote: undefined });
    expect(noNote).not.toContain('หมายเหตุ');
  });
});

describe('Rest Hours message templates', () => {
  const args = {
    driver: 'Annual Natsamrong',
    vehicle: '72-1281(DMS)',
    threshold: 10,
    valueHours: 6.5,
    loginAt: '2026-05-01T04:14:00Z',
    logoutAt: '2026-05-01T13:25:00Z',
    loginLocation: 'Thongfleet',
    logoutLocation: 'THONG TRANSPORT',
    distanceKm: 142.6,
    dashboardName: 'ThongTrans / Bangkok',
  };

  it('Thai template', () => {
    const out = buildRestHoursMessageThai(args);
    expect(out).toContain('⚠ พักน้อยกว่า 10:00:00');
    expect(out).toContain('Rest Time:');
    expect(out).toContain('รถ: 72-1281(DMS)');
  });

  it('English template', () => {
    const out = buildRestHoursMessageEnglish(args);
    expect(out).toContain('Rest Time < 10:00:00');
    expect(out).toContain('Rest Time:');
  });
});
