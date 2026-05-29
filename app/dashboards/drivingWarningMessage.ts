type DriveHoursArgs = {
  driver: string;
  dayKey: string;
  threshold: number;
  valueHours: number;
  shiftCount: number;
  vehicleSummary: string;
  firstLoginAt: string | null;
  lastLogoutAt: string | null;
  firstLoginLocation: string | null;
  lastLogoutLocation: string | null;
  distanceKm: number | null;
  operatorNote?: string;
  dashboardName: string;
};

type RestHoursArgs = {
  driver: string;
  vehicle: string;
  threshold: number;
  valueHours: number;
  loginAt: string | null;
  logoutAt: string | null;
  loginLocation: string | null;
  logoutLocation: string | null;
  distanceKm: number | null;
  operatorNote?: string;
  dashboardName: string;
};

function fmtDt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function fmtNum(n: number | null, suffix = ''): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(Math.round(n * 10) / 10).toString()}${suffix}`;
}

export function buildDriveHoursMessageThai(args: DriveHoursArgs): string {
  const lines = [
    `⚠ ขับรถเกิน ${args.threshold} ชม./วัน`,
    `คนขับ: ${args.driver}`,
    `วันที่: ${args.dayKey}`,
    `รวมชั่วโมงขับ: ${fmtNum(args.valueHours)} ชม. (เกิน ${args.threshold} ชม.)`,
    `จำนวนกะ: ${args.shiftCount}  ·  รถ: ${args.vehicleSummary}`,
    `เริ่มกะแรก: ${fmtDt(args.firstLoginAt)} (${args.firstLoginLocation ?? '—'})`,
    `จบกะสุดท้าย: ${fmtDt(args.lastLogoutAt)} (${args.lastLogoutLocation ?? '—'})`,
    `ระยะทางรวม: ${fmtNum(args.distanceKm)} กม.`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`หมายเหตุ: ${args.operatorNote.trim()}`);
  }
  lines.push(`— แดชบอร์ด ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildDriveHoursMessageEnglish(args: DriveHoursArgs): string {
  const lines = [
    `⚠ Drive Hours > ${args.threshold} h/day`,
    `Driver: ${args.driver}`,
    `Date: ${args.dayKey}`,
    `Total drive hours: ${fmtNum(args.valueHours)} h (over ${args.threshold} h)`,
    `Shifts: ${args.shiftCount}  ·  Vehicle: ${args.vehicleSummary}`,
    `First shift start: ${fmtDt(args.firstLoginAt)} (${args.firstLoginLocation ?? '—'})`,
    `Last shift end:    ${fmtDt(args.lastLogoutAt)} (${args.lastLogoutLocation ?? '—'})`,
    `Total distance: ${fmtNum(args.distanceKm)} km`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`Note: ${args.operatorNote.trim()}`);
  }
  lines.push(`— Dashboard ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildRestHoursMessageThai(args: RestHoursArgs): string {
  const lines = [
    `⚠ พักน้อยกว่า ${args.threshold} ชม.`,
    `คนขับ: ${args.driver}`,
    `รถ: ${args.vehicle}`,
    `ชั่วโมงพัก: ${fmtNum(args.valueHours)} ชม. (ต่ำกว่า ${args.threshold} ชม.)`,
    `เริ่มกะ: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `จบกะ: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `ระยะทาง: ${fmtNum(args.distanceKm)} กม.`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`หมายเหตุ: ${args.operatorNote.trim()}`);
  }
  lines.push(`— แดชบอร์ด ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildRestHoursMessageEnglish(args: RestHoursArgs): string {
  const lines = [
    `⚠ Rest Hours < ${args.threshold} h`,
    `Driver: ${args.driver}`,
    `Vehicle: ${args.vehicle}`,
    `Rest hours: ${fmtNum(args.valueHours)} h (under ${args.threshold} h)`,
    `Shift start: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `Shift end:   ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} km`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`Note: ${args.operatorNote.trim()}`);
  }
  lines.push(`— Dashboard ${args.dashboardName}`);
  return lines.join('\n');
}

type CntDrvHoursArgs = {
  driver: string;
  vehicle: string;
  threshold: number;
  valueHours: number;
  loginAt: string | null;
  logoutAt: string | null;
  loginLocation: string | null;
  logoutLocation: string | null;
  distanceKm: number | null;
  operatorNote?: string;
  dashboardName: string;
};

export function buildCntDrvHoursMessageThai(args: CntDrvHoursArgs): string {
  const lines = [
    `⚠ ขับต่อเนื่องเกิน ${args.threshold} ชม.`,
    `คนขับ: ${args.driver}`,
    `รถ: ${args.vehicle}`,
    `ชั่วโมงขับต่อเนื่อง: ${fmtNum(args.valueHours)} ชม. (เกิน ${args.threshold} ชม.)`,
    `เริ่ม: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `จบ: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `ระยะทาง: ${fmtNum(args.distanceKm)} กม.`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`หมายเหตุ: ${args.operatorNote.trim()}`);
  }
  lines.push(`— แดชบอร์ด ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildCntDrvHoursMessageEnglish(args: CntDrvHoursArgs): string {
  const lines = [
    `⚠ Continuous drive > ${args.threshold} h`,
    `Driver: ${args.driver}`,
    `Vehicle: ${args.vehicle}`,
    `Continuous drive hours: ${fmtNum(args.valueHours)} h (over ${args.threshold} h)`,
    `Start: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `End:   ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} km`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`Note: ${args.operatorNote.trim()}`);
  }
  lines.push(`— Dashboard ${args.dashboardName}`);
  return lines.join('\n');
}
