import { formatDurationDisplay, hoursToHms } from './drivingDurationFormat';

type DriveHoursArgs = {
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

function fmtHours(n: number): string {
  return formatDurationDisplay(null, n);
}

export function buildDriveHoursMessageThai(args: DriveHoursArgs): string {
  const lines = [
    `⚠ ขับรถเกิน ${hoursToHms(args.threshold)} ต่อทริป`,
    `คนขับ: ${args.driver}`,
    `รถ: ${args.vehicle}`,
    `DriveHrs: ${fmtHours(args.valueHours)} (เกิน ${hoursToHms(args.threshold)})`,
    `Login Time: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `Logout Time: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} กม.`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`หมายเหตุ: ${args.operatorNote.trim()}`);
  }
  lines.push(`— แดชบอร์ด ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildDriveHoursMessageEnglish(args: DriveHoursArgs): string {
  const lines = [
    `⚠ DriveHrs > ${hoursToHms(args.threshold)} per trip`,
    `Driver: ${args.driver}`,
    `Vehicle: ${args.vehicle}`,
    `DriveHrs: ${fmtHours(args.valueHours)} (over ${hoursToHms(args.threshold)})`,
    `Login Time: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `Logout Time: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} km`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`Note: ${args.operatorNote.trim()}`);
  }
  lines.push(`— Dashboard ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildRestHoursMessageThai(args: RestHoursArgs): string {
  const lines = [
    `⚠ พักน้อยกว่า ${hoursToHms(args.threshold)}`,
    `คนขับ: ${args.driver}`,
    `รถ: ${args.vehicle}`,
    `Rest Time: ${fmtHours(args.valueHours)} (ต่ำกว่า ${hoursToHms(args.threshold)})`,
    `Login Time: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `Logout Time: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} กม.`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`หมายเหตุ: ${args.operatorNote.trim()}`);
  }
  lines.push(`— แดชบอร์ด ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildRestHoursMessageEnglish(args: RestHoursArgs): string {
  const lines = [
    `⚠ Rest Time < ${hoursToHms(args.threshold)}`,
    `Driver: ${args.driver}`,
    `Vehicle: ${args.vehicle}`,
    `Rest Time: ${fmtHours(args.valueHours)} (under ${hoursToHms(args.threshold)})`,
    `Login Time: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `Logout Time: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
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
    `⚠ ขับต่อเนื่องเกิน ${hoursToHms(args.threshold)}`,
    `คนขับ: ${args.driver}`,
    `รถ: ${args.vehicle}`,
    `Cnt Drv Hr: ${fmtHours(args.valueHours)} (เกิน ${hoursToHms(args.threshold)})`,
    `Start Time: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `End Time: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} กม.`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`หมายเหตุ: ${args.operatorNote.trim()}`);
  }
  lines.push(`— แดชบอร์ด ${args.dashboardName}`);
  return lines.join('\n');
}

export function buildCntDrvHoursMessageEnglish(args: CntDrvHoursArgs): string {
  const lines = [
    `⚠ Cnt Drv Hr > ${hoursToHms(args.threshold)}`,
    `Driver: ${args.driver}`,
    `Vehicle: ${args.vehicle}`,
    `Cnt Drv Hr: ${fmtHours(args.valueHours)} (over ${hoursToHms(args.threshold)})`,
    `Start Time: ${fmtDt(args.loginAt)} (${args.loginLocation ?? '—'})`,
    `End Time: ${fmtDt(args.logoutAt)} (${args.logoutLocation ?? '—'})`,
    `Distance: ${fmtNum(args.distanceKm)} km`,
  ];
  if (args.operatorNote && args.operatorNote.trim()) {
    lines.push(`Note: ${args.operatorNote.trim()}`);
  }
  lines.push(`— Dashboard ${args.dashboardName}`);
  return lines.join('\n');
}
