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
    dayKey: '2026-05-01',
    threshold: 10,
    valueHours: 12.4,
    shiftCount: 3,
    vehicleSummary: '3 vehicles',
    firstLoginAt: '2026-05-01T04:14:00Z',
    lastLogoutAt: '2026-05-01T13:25:00Z',
    firstLoginLocation: 'Thongfleet',
    lastLogoutLocation: 'THONG TRANSPORT',
    distanceKm: 142.6,
    operatorNote: 'please follow up',
    dashboardName: 'ThongTrans / Bangkok',
  };

  it('Thai includes header, total, shift count, and dashboard name', () => {
    const out = buildDriveHoursMessageThai(args);
    expect(out).toContain('⚠ ขับรถเกิน 10 ชม./วัน');
    expect(out).toContain('คนขับ: Annual Natsamrong');
    expect(out).toContain('วันที่: 2026-05-01');
    expect(out).toContain('รวมชั่วโมงขับ: 12.4 ชม.');
    expect(out).toContain('จำนวนกะ: 3');
    expect(out).toContain('รถ: 3 vehicles');
    expect(out).toContain('ระยะทางรวม: 142.6 กม.');
    expect(out).toContain('หมายเหตุ: please follow up');
    expect(out).toContain('— แดชบอร์ด ThongTrans / Bangkok');
  });

  it('English mirror of the Thai template', () => {
    const out = buildDriveHoursMessageEnglish(args);
    expect(out).toContain('Drive Hours > 10 h/day');
    expect(out).toContain('Driver: Annual Natsamrong');
    expect(out).toContain('Total drive hours: 12.4 h');
    expect(out).toContain('Shifts: 3');
    expect(out).toContain('Vehicle: 3 vehicles');
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
    expect(out).toContain('⚠ พักน้อยกว่า 10 ชม.');
    expect(out).toContain('ชั่วโมงพัก: 6.5 ชม.');
    expect(out).toContain('รถ: 72-1281(DMS)');
  });

  it('English template', () => {
    const out = buildRestHoursMessageEnglish(args);
    expect(out).toContain('Rest Hours < 10 h');
    expect(out).toContain('Rest hours: 6.5 h');
  });
});
