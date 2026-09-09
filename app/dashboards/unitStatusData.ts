import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import type { GoogleSheetRow } from './googleSheetParse';
import { isUnitApiUpdateStale } from './unitDeviceStatus';

export type UnitUpdateStatus = 'recent' | 'stale' | 'unknown';

export type UnitHealth = 'online' | 'offline' | 'unknown';
export const DEVICE_FIELDS = [
  { key: 'gpsStatus', en: 'GPS', th: 'GPS' },
  { key: 'statusAi', en: 'Status AI', th: 'สถานะ AI' },
  { key: 'deviceStatus', en: 'Device status', th: 'สถานะอุปกรณ์' },
  { key: 'ch1Ai', en: 'CH1 AI', th: 'CH1 AI' },
  { key: 'reverseBsd', en: 'Reverse BSD', th: 'BSD ด้านหลัง' },
  { key: 'front', en: 'Front camera', th: 'กล้องหน้า' },
  { key: 'frontBsd', en: 'Front BSD', th: 'BSD ด้านหน้า' },
  { key: 'rearRight', en: 'Rear right', th: 'ด้านหลังขวา' },
  { key: 'rearLeft', en: 'Rear left', th: 'ด้านหลังซ้าย' },
  { key: 'leftBsd', en: 'Left BSD', th: 'BSD ด้านซ้าย' },
  { key: 'rightBsd', en: 'Right BSD', th: 'BSD ด้านขวา' },
  { key: 'cabin', en: 'Cabin', th: 'ห้องโดยสาร' },
  { key: 'storage', en: 'Storage', th: 'พื้นที่จัดเก็บ' },
  { key: 'seatVibrator', en: 'Seat vibrator', th: 'เบาะสั่น' },
  { key: 'intercom', en: 'Intercom', th: 'อินเตอร์คอม' },
] as const;
export type UnitDeviceKey = typeof DEVICE_FIELDS[number]['key'];

/** BIGTH vocabulary, including the actual sheet's check/cross symbols. */
export function readUnitHealth(value: string): UnitHealth {
  const text = normalizeLabel(value);
  if (!isReportedValue(text)) return 'unknown';
  // Match complete words: "inactive", "network", and "broken" must not
  // become healthy because they contain "active", "work", or "ok".
  // A negated failure does not prove health; it only removes that failure signal.
  const signals = text.replace(/\b(?:no|not)\s+(?:damage[ds]?|errors?|alerts?|failures?|offline)\b/g, '');
  if (/[✖✗✕×❌]/.test(text)
    || /\b(?:offline|fail(?:ed|ure)?|errors?|damage[ds]?|abnormal|lost|no\s+(?:signal|network)|alerts?|broken|inactive|not\s+(?:ready|working?|active|online|recording)|nonexist|not\s*exist)\b/.test(signals)
    || ['false', '0', 'no', 'storagenonexist'].includes(text)) return 'offline';
  if (/[✔✓✅]/.test(text)
    || /\b(?:online|normal|ok|active|good|ready|work(?:ing)?)\b/.test(signals)
    || ['true', '1', 'yes', 'exist', 'storageexist'].includes(text)) return 'online';
  return 'unknown';
}

const STATUS_ALIASES: Record<UnitDeviceKey, string[]> = {
  gpsStatus: ['GPS Status', 'gps'], statusAi: ['Status AI'], deviceStatus: ['Device Status'],
  ch1Ai: ['CH1 AI'], reverseBsd: ['Reverse BSD'], front: ['Front', 'Front Camera'],
  frontBsd: ['Front BSD'], rearRight: ['Rear Right'], rearLeft: ['Rear Left'],
  leftBsd: ['Left BSD'], rightBsd: ['Right BSD'], cabin: ['Cabin'],
  storage: ['Storage', 'storagestatus', 'Storage Status'], seatVibrator: ['Seat Vibrator'], intercom: ['Intercom'],
};

// Only literal camera names are portable. Numeric channels and Driver/AI/Reverse 1
// have customer-specific wiring and cannot establish a BIGTH camera's health.
const CAMERA_NAMES: Partial<Record<UnitDeviceKey, string[]>> = {
  ch1Ai: ['CH1 AI'], reverseBsd: ['Reverse BSD'], front: ['Front', 'Front Camera'],
  frontBsd: ['Front BSD'], rearRight: ['Rear Right'], rearLeft: ['Rear Left'],
  leftBsd: ['Left BSD'], rightBsd: ['Right BSD'], cabin: ['Cabin'],
};

function readDeviceStatuses(row: GoogleSheetRow): Record<UnitDeviceKey, UnitHealth> {
  const result = {} as Record<UnitDeviceKey, UnitHealth>;
  const recording = readText(row, ['recording']).split(',').map(normalizeLabel);
  const loss = readText(row, ['videoloss', 'Video Loss']).split(',').map(normalizeLabel);
  for (const { key } of DEVICE_FIELDS) {
    const aliases = STATUS_ALIASES[key];
    result[key] = readUnitHealth(readText(row, aliases));
    // An explicit status column (including unknown) takes precedence over telemetry.
    if (!hasAliasedColumn(Object.keys(row), aliases)) {
      const names = CAMERA_NAMES[key]?.map(normalizeLabel) ?? [];
      if (names.some((name) => loss.includes(name))) result[key] = 'offline';
      else if (names.some((name) => recording.includes(name))) result[key] = 'online';
    }
  }
  result.intercom = 'online'; // Required for all companies: no trigger logic in source.
  return result;
}

type CameraMetadata = { key: string; fleet: string; expectedCameras: number | null };
function readCameraMetadata(rows: GoogleSheetRow[]): CameraMetadata[] {
  return rows.flatMap((row) => {
    const key = normalizeLabel(readText(row, VEHICLE_NO_ALIASES));
    if (!key || VEHICLE_NO_HEADERS.has(key)) return [];
    const raw = readText(row, ['CH']).trim();
    const count = Number(raw);
    return [{ key, fleet: readText(row, FLEET_ALIASES).trim(),
      expectedCameras: raw && Number.isInteger(count) && count >= 0 ? count : null }];
  });
}

/** BIGTH installation totals, bounded to authorized or already established fleets. */
export function buildInstallRows(chRows: GoogleSheetRow[], units: UnitRow[], scopeSet: ReadonlySet<string> = new Set()) {
  const fleets = new Set((scopeSet.size ? Array.from(scopeSet) : units.map((unit) => unit.fleet)).map(normalizeLabel).filter(Boolean));
  const grouped = new Map<string, { fleet: string; vehicles: number; cameras: number; unknownCameraUnits: number }>();
  const seen = new Set<string>();
  for (const item of readCameraMetadata(chRows)) {
    const fleetKey = normalizeLabel(item.fleet);
    const identity = `${fleetKey}:${item.key}`;
    if (!fleets.has(fleetKey) || seen.has(identity)) continue;
    seen.add(identity);
    const total = grouped.get(fleetKey) ?? { fleet: item.fleet, vehicles: 0, cameras: 0, unknownCameraUnits: 0 };
    total.vehicles += 1;
    total.cameras += item.expectedCameras ?? 0;
    total.unknownCameraUnits += Number(item.expectedCameras === null);
    grouped.set(fleetKey, total);
  }
  return Array.from(grouped.values()).sort((a, b) => a.fleet.localeCompare(b.fleet));
}

export type UnitRow = {
  vehicleNo: string;
  location: string;
  fleet: string;
  deviceType: string;
  updatedRaw: string;
  updatedAt: Date | null;
  dataTime: string;
  gps: string;
  network: string;
  storageRaw: string;
  driver: string;
  type: string;
  statuses: Record<UnitDeviceKey, UnitHealth>;
  expectedCameras: number | null;
  activeCameras: number;
  recording: string;
  videoLoss: string;
  storageAlert: string;
  storageAlertTime: string;
  lastAiAlert: string;
  lastAiAlertTime: string;
  speed: string;
  direction: string;
  hdop: string;
  mainPower: string;
  battery: string;
  idKeyLastDetected: string;
  updateStatus: UnitUpdateStatus;
};

const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1_000;
const VEHICLE_NO_ALIASES = ['vehicleno', 'Vehicle No', 'Vehicle Number'];
const USERNAME_ALIASES = ['username', 'User Name'];
const FLEET_ALIASES = ['Fleet', 'Fleet Name'];
const VEHICLE_NO_HEADERS = new Set(VEHICLE_NO_ALIASES.map(normalizeLabel));

function hasAliasedColumn(labels: readonly string[], aliases: readonly string[]): boolean {
  const normalizedLabels = new Set(labels.map(normalizeLabel));
  return aliases.some((alias) => normalizedLabels.has(normalizeLabel(alias)));
}

/** Validate the source with the exact header aliases used to read its rows. */
export function hasUnitStatusColumns(columns: readonly { label: string }[]): boolean {
  const labels = columns.map((column) => column.label);
  return hasAliasedColumn(labels, VEHICLE_NO_ALIASES)
    && hasAliasedColumn(labels, ['GPS Status', 'gps', 'lastupdatedtime', 'Date & time', 'datatime']);
}

function readText(row: GoogleSheetRow, aliases: string[]): string {
  const value = findValue(row, aliases);
  return value == null ? '' : String(value);
}

/** Whether the source actually reports a value; numeric zero remains meaningful. */
export function isReportedValue(value: string): boolean {
  const normalized = normalizeLabel(value);
  return normalized !== '' && !['na', 'n/a', 'none', 'null', '-', '—'].includes(normalized);
}

/** One common status model, with source and authorized fleet boundaries applied first. */
export function buildUnitRows(
  rows: GoogleSheetRow[],
  chRows: GoogleSheetRow[],
  scopeSet: ReadonlySet<string>,
  now: Date,
  companyName?: string | null,
): UnitRow[] {
  const normalizedScope = new Set(Array.from(scopeSet).map(normalizeLabel));
  const hasFleetColumn = rows.some((row) => hasAliasedColumn(Object.keys(row), FLEET_ALIASES));
  const hasUsernameColumn = rows.some((row) => hasAliasedColumn(Object.keys(row), USERNAME_ALIASES));
  const company = normalizeLabel(companyName ?? '');
  const metadata = readCameraMetadata(chRows);
  const nowWallClockMs = now.getTime() + BANGKOK_UTC_OFFSET_MS;
  const unitsByVehicle = new Map<string, UnitRow>();

  for (const row of rows) {
    const usernames = readText(row, USERNAME_ALIASES).split(',').map(normalizeLabel);
    const vehicleNo = readText(row, VEHICLE_NO_ALIASES).trim();
    const vehicleKey = normalizeLabel(vehicleNo);
    if (!vehicleKey || VEHICLE_NO_HEADERS.has(vehicleKey)) continue;
    const primaryFleet = readText(row, FLEET_ALIASES).trim();
    const code = normalizeLabel(readText(row, ['Code No']));
    const candidates = metadata.filter((item) => (item.key === vehicleKey || (code && item.key === code))
      && (!primaryFleet || normalizeLabel(item.fleet) === normalizeLabel(primaryFleet))
      && (normalizedScope.size === 0 || normalizedScope.has(normalizeLabel(item.fleet))));
    // A repeated ID in different fleets is ambiguous: never guess its installation.
    const uniqueMetadata = new Map(candidates.map((item) => [`${item.key}:${normalizeLabel(item.fleet)}`, item]));
    const camera = uniqueMetadata.size === 1 ? Array.from(uniqueMetadata.values())[0] : undefined;
    const fleet = hasFleetColumn ? primaryFleet : camera?.fleet
      || usernames.find((name) => normalizedScope.has(name)) || '';
    if (normalizedScope.size > 0) {
      if (!fleet || !normalizedScope.has(normalizeLabel(fleet))) continue;
    }
    if (company && hasUsernameColumn && !usernames.includes(company)) {
      // Source username is an exact comma-separated membership token, never a substring.
      continue;
    }

    const dataTime = readText(row, ['Date & time', 'Date & time 2', 'datatime', 'Data Time']);
    const lastUpdatedTime = readText(row, ['lastupdatedtime', 'Last Updated Time', 'Last Update Time']);
    // A present but invalid API timestamp must remain unknown, even if dataTime
    // parses. Only a blank lastupdatedtime permits the source-time fallback.
    const updatedRaw = lastUpdatedTime.trim() ? lastUpdatedTime : dataTime;
    const parsedUpdatedAt = parseDate(updatedRaw);
    const updatedAt = parsedUpdatedAt
      && Number.isFinite(nowWallClockMs)
      && Number.isFinite(parsedUpdatedAt.getTime())
      && parsedUpdatedAt.getTime() <= nowWallClockMs
      ? parsedUpdatedAt
      : null;
    const updateStatus: UnitUpdateStatus = updatedAt
      ? (isUnitApiUpdateStale(updatedAt, now) ? 'stale' : 'recent')
      : 'unknown';

    const statuses = readDeviceStatuses(row);
    const unit: UnitRow = {
      vehicleNo,
      location: readText(row, ['location']),
      fleet,
      deviceType: readText(row, ['devicetype', 'Device Type']),
      updatedRaw,
      updatedAt,
      dataTime,
      gps: readText(row, ['GPS Status', 'gps']),
      network: readText(row, ['networksignal', 'Network Signal']),
      storageRaw: readText(row, ['Storage', 'storagestatus', 'Storage Status']),
      driver: readText(row, ['Driver Name', 'Driver']),
      type: readText(row, ['Type', 'Device Type', 'devicetype', 'Status Type']),
      statuses,
      expectedCameras: camera?.expectedCameras ?? null,
      activeCameras: ['ch1Ai', 'front', 'rearRight', 'rearLeft', 'cabin'].filter((key) => statuses[key as UnitDeviceKey] === 'online').length,
      recording: readText(row, ['recording']),
      videoLoss: readText(row, ['videoloss', 'Video Loss']),
      storageAlert: readText(row, ['storagealert', 'Storage Alert']),
      storageAlertTime: readText(row, ['storagelastalert', 'Storage Last Alert']),
      lastAiAlert: readText(row, ['lastaialert', 'Last AI Alert']),
      lastAiAlertTime: readText(row, ['lastaialerttime', 'Last AI Alert Time']),
      speed: readText(row, ['speed']),
      direction: readText(row, ['direction']),
      hdop: readText(row, ['hdop']),
      mainPower: readText(row, ['mainpower', 'Main Power']),
      battery: readText(row, ['battery']),
      idKeyLastDetected: readText(row, ['idkeylastdetected', 'ID Key Last Detected']),
      updateStatus,
    };

    const unitKey = `${normalizeLabel(fleet)}:${vehicleKey}`;
    const existing = unitsByVehicle.get(unitKey);
    if (!existing || (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt))) {
      unitsByVehicle.set(unitKey, unit);
    }
  }

  return Array.from(unitsByVehicle.values()).sort((a, b) =>
    a.vehicleNo.localeCompare(b.vehicleNo, 'en', { numeric: true, sensitivity: 'base' }),
  );
}
