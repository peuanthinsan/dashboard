import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import type { GoogleSheetRow } from './googleSheetParse';
import { isUnitApiUpdateStale } from './unitDeviceStatus';

export type UnitUpdateStatus = 'recent' | 'stale' | 'unknown';

export type UnitHealth = 'online' | 'offline' | 'unknown';
export type UnitOverallStatus = 'healthy' | 'warning' | 'offline' | 'unknown';
export const CAMERA_CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type UnitCameraChannel = typeof CAMERA_CHANNELS[number];
export const CAMERA_FIELDS = [
  { key: 'ch1Ai', en: 'AI camera', th: 'กล้อง AI' },
  { key: 'front', en: 'Front camera', th: 'กล้องหน้า' },
  { key: 'rearRight', en: 'Rear right', th: 'ด้านหลังขวา' },
  { key: 'rearLeft', en: 'Rear left', th: 'ด้านหลังซ้าย' },
  { key: 'cabin', en: 'Cabin', th: 'ห้องโดยสาร' },
] as const;
export const DEVICE_FIELDS = [
  { key: 'gpsStatus', en: 'GPS', th: 'GPS' },
  { key: 'statusAi', en: 'Status AI', th: 'สถานะ AI' },
  { key: 'deviceStatus', en: 'Device status', th: 'สถานะอุปกรณ์' },
  { key: 'ch1Ai', en: 'AI camera', th: 'กล้อง AI' },
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
  { key: 'mcr', en: 'MCR', th: 'MCR' },
  { key: 'mdvr', en: 'MDVR', th: 'MDVR' },
  { key: 'ivms', en: 'IVMS', th: 'IVMS' },
  { key: 'fatigueAi', en: 'Fatigue AI', th: 'AI ตรวจจับความเหนื่อยล้า' },
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
  mcr: ['MCR', 'MCR Status'], mdvr: ['MDVR', 'MDVR Status'], ivms: ['IVMS', 'IVMS Status'],
  fatigueAi: ['Fatigue AI', 'Fatigue AI Status'],
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

// Preserve the legacy telemetry channel schema independently of BIGTH camera
// positions. C1 is not evidence that BIGTH's Front or CH1 AI check is online.
const RAW_CAMERA_NAMES: Record<string, UnitCameraChannel> = {
  front: 1, driver: 2, ai: 3, 'rear right': 4, rearright: 4,
  'rear left': 5, rearleft: 5,
};

function cameraTokens(value: string, sourceNames: string[] = []): Set<UnitCameraChannel> {
  const channels = new Set<UnitCameraChannel>();
  for (const raw of value.split(',')) {
    const token = normalizeLabel(raw);
    const numeric = Number(token);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 9) {
      channels.add(numeric as UnitCameraChannel);
    } else if (sourceNames.some((name) => name.trim())) {
      const matches = sourceNames.map((name, index) => normalizeLabel(name) === token ? index + 1 : 0).filter(Boolean);
      if (matches.length === 1 && matches[0] <= 9) channels.add(matches[0] as UnitCameraChannel);
    } else if (Object.hasOwn(RAW_CAMERA_NAMES, token)) {
      channels.add(RAW_CAMERA_NAMES[token]);
    }
  }
  return channels;
}

function parseCameraMask(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^(?:\d+|0x[\da-f]+)$/i.test(value.trim())) return null;
  const mask = Number(value);
  return Number.isSafeInteger(mask) && mask >= 0 && mask <= 0xffff ? mask : null;
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function readCameraChannels(row: GoogleSheetRow) {
  const recordingRaw = readText(row, ['recording']);
  const lossRaw = readText(row, ['videoloss', 'Video Loss']);
  const stopped = normalizeLabel(recordingRaw) === 'notrecording';
  const result = {} as Record<UnitCameraChannel, UnitHealth>;
  const present = {} as Record<UnitCameraChannel, boolean>;
  const names = {} as Record<UnitCameraChannel, string>;
  const representedChecklistKeys = new Set<UnitDeviceKey>();
  const labels = Object.keys(row);
  // VSS inventory and current health are different masks. Unused inputs may
  // appear in videoLost. Never infer installation from those phantom loss bits.
  const raw = readObject(findValue(row, ['raw_payload', 'Raw Payload']));
  const mask = parseCameraMask(findValue(row, ['usableChs', 'Usable Channels']) ?? raw.usableChs);
  const channelNames = String(findValue(row, ['channelname', 'Camera Names']) ?? raw.channelname ?? '').split(';');
  const recording = cameraTokens(recordingRaw, mask !== null ? channelNames : []);
  const loss = cameraTokens(lossRaw, mask !== null ? channelNames : []);
  const status = readObject(findValue(row, ['lastStatusJson', 'Last Status JSON']) ?? raw.lastStatusJson);
  const modules = status.module && typeof status.module === 'object' ? status.module as Record<string, unknown> : {};
  const alarm = status.alarm && typeof status.alarm === 'object' ? status.alarm as Record<string, unknown> : {};
  const recordMask = parseCameraMask(modules.record);
  const lossMask = parseCameraMask(alarm.videoLost);
  const malformedHealth = (Object.hasOwn(modules, 'record') && recordMask === null)
    || (Object.hasOwn(alarm, 'videoLost') && lossMask === null);
  const namedLoss = new Set(lossRaw.split(',').map(normalizeLabel)
    .filter((name) => Object.hasOwn(RAW_CAMERA_NAMES, name)).map((name) => RAW_CAMERA_NAMES[name]));
  for (const channel of CAMERA_CHANNELS) {
    const bit = 1 << (channel - 1);
    const aliases = [`Camera CH${channel}`, `CH${channel}`, `C${channel}`, `Camera ${channel}`, `Camera${channel}`];
    const direct = hasAliasedColumn(labels, aliases);
    // Sheet-only fallback displays observed cameras; a count does not establish
    // a contiguous channel layout, and a blank shared column is not installation.
    present[channel] = mask !== null ? (mask & bit) !== 0
      : recording.has(channel) || namedLoss.has(channel) || (direct && isReportedValue(readText(row, aliases)));
    const name = channelNames[channel - 1]?.trim() || (mask === null
      ? [...recordingRaw.split(','), ...lossRaw.split(',')].find((value) => RAW_CAMERA_NAMES[normalizeLabel(value)] === channel)?.trim() ?? '' : '');
    names[channel] = /^ch\s*\d+$/i.test(name) ? '' : name;
    if (!present[channel]) {
      result[channel] = 'unknown';
    } else if (direct) {
      const value = normalizeLabel(readText(row, aliases));
      result[channel] = ['connected', 'connect', 'on'].includes(value) ? 'online'
        : ['disconnected', 'disconnect', 'off'].includes(value) ? 'offline' : readUnitHealth(value);
    } else if (mask !== null) {
      if (recordMask !== null && lossMask !== null) {
        result[channel] = (recordMask & bit) !== 0 && (lossMask & bit) === 0 ? 'online' : 'offline';
      } else {
        result[channel] = (lossMask !== null && (lossMask & bit) !== 0) || loss.has(channel) || stopped
          || (recordMask !== null && (recordMask & bit) === 0) ? 'offline'
          : malformedHealth || recordMask !== null ? 'unknown' : recording.has(channel) ? 'online' : 'unknown';
      }
    } else {
      result[channel] = stopped || loss.has(channel) ? 'offline'
        : recording.has(channel) ? 'online' : 'unknown';
    }
    // An explicit positional field can override the same literal camera name,
    // but never a guessed numeric position. Other cameras retain their evidence.
    if (present[channel] && !direct) {
      const literalNames = mask !== null ? [channelNames[channel - 1] ?? '']
        : [...recordingRaw.split(','), ...lossRaw.split(',')].filter((name) => RAW_CAMERA_NAMES[normalizeLabel(name)] === channel);
      const explicit = CAMERA_FIELDS.find((field) => hasAliasedColumn(labels, STATUS_ALIASES[field.key])
        && literalNames.some((name) => STATUS_ALIASES[field.key].map(normalizeLabel).includes(normalizeLabel(name))));
      if (explicit) {
        result[channel] = readUnitHealth(readText(row, STATUS_ALIASES[explicit.key]));
        representedChecklistKeys.add(explicit.key);
      }
    }
  }
  return { channels: result, present, names, representedChecklistKeys, inventoryKnown: mask !== null,
    installedCount: mask !== null ? CAMERA_CHANNELS.filter((channel) => (mask & (1 << (channel - 1))) !== 0).length : null };
}

export type UnitCheck = { key: string; en: string; th: string; status: UnitHealth; present?: boolean };
type CameraRow = Pick<UnitRow, 'cameraSource' | 'cameraChannels' | 'cameraPresent' | 'cameraLabels' | 'cameraChecklistPresent' | 'cameraAdditionalChecks' | 'statuses'>;

export function getUnitCameraChecks(row: CameraRow): UnitCheck[] {
  return row.cameraSource === 'checklist'
    ? CAMERA_FIELDS.map((field) => ({ ...field, ...(field.key === 'ch1Ai' ? { en: 'AI camera', th: 'กล้อง AI' } : {}), status: row.statuses[field.key], present: row.cameraChecklistPresent.includes(field.key) }))
    : CAMERA_CHANNELS.map((channel) => ({ key: `c${channel}`, en: row.cameraLabels[channel] || `Camera ${channel}`, th: row.cameraLabels[channel] || `กล้อง ${channel}`, status: row.cameraChannels[channel], present: row.cameraPresent[channel] }));
}

/** Each check is counted once; channel telemetry never substitutes for BSD wiring. */
export function getUnitChecks(row: CameraRow): UnitCheck[] {
  const cameraKeys = new Set<string>(CAMERA_FIELDS.map((field) => field.key));
  const devices = DEVICE_FIELDS.filter((field) => !cameraKeys.has(field.key) || (row.cameraSource === 'channels' && row.cameraAdditionalChecks.includes(field.key)))
    .map((field) => ({ ...field, status: row.statuses[field.key] }));
  return [...devices, ...getUnitCameraChecks(row).filter((check) => check.present !== false)];
}

function readOverallStatus(row: CameraRow & Pick<UnitRow, 'updateStatus' | 'expectedCameras'>): UnitOverallStatus {
  if (row.updateStatus === 'stale' || row.statuses.gpsStatus === 'offline' || row.statuses.deviceStatus === 'offline') return 'offline';
  if (getUnitChecks(row).some((check) => check.status === 'offline')) return 'warning';
  const cameras = getUnitCameraChecks(row).filter((check) => check.present !== false);
  if (row.statuses.gpsStatus !== 'online' || (cameras.length === 0 && row.expectedCameras !== 0)
    || (row.expectedCameras !== null && cameras.length < row.expectedCameras)
    || cameras.some((check) => check.status === 'unknown')) return 'unknown';
  return 'healthy';
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
  cameraSource: 'channels' | 'checklist';
  cameraChannels: Record<UnitCameraChannel, UnitHealth>;
  cameraPresent: Record<UnitCameraChannel, boolean>;
  cameraLabels: Record<UnitCameraChannel, string>;
  cameraChecklistPresent: string[];
  cameraAdditionalChecks: string[];
  cameraInventoryKnown: boolean;
  overallStatus: UnitOverallStatus;
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
// Source account names can differ from the dashboard's company display name.
// The ALCHEM tab explicitly queries username for Alcsongdee.
const COMPANY_USERNAME_ALIASES: ReadonlyMap<string, readonly string[]> = new Map([
  ['alchem', ['alcsongdee']],
]);
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
  const companyUsernames = new Set([company, ...(COMPANY_USERNAME_ALIASES.get(company) ?? [])]);
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
    if (company && hasUsernameColumn && !usernames.some((username) => companyUsernames.has(username))) {
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
    const cameraTelemetry = readCameraChannels(row);
    const cameraChannels = cameraTelemetry.channels;
    const cameraSource = cameraTelemetry.inventoryKnown || Object.values(cameraTelemetry.present).some(Boolean)
      ? 'channels' : CAMERA_FIELDS.some((field) => isReportedValue(readText(row, STATUS_ALIASES[field.key]))) ? 'checklist' : 'channels';
    const cameraState = { statuses, cameraChannels, cameraSource,
      cameraPresent: cameraTelemetry.present, cameraLabels: cameraTelemetry.names,
      cameraChecklistPresent: CAMERA_FIELDS.filter((field) => statuses[field.key] !== 'unknown' || isReportedValue(readText(row, STATUS_ALIASES[field.key]))).map((field) => field.key),
      // Preserve independent positional checks, but count an explicit field only
      // once when its literal name already supplies the raw camera's status.
      cameraAdditionalChecks: CAMERA_FIELDS.filter((field) => !cameraTelemetry.representedChecklistKeys.has(field.key)
        && (isReportedValue(readText(row, STATUS_ALIASES[field.key]))
          || (!['front', 'rearRight', 'rearLeft'].includes(field.key) && statuses[field.key] !== 'unknown'))).map((field) => field.key),
    } as const;
    const preparedCameraChecklist = CAMERA_FIELDS.every((field) => hasAliasedColumn(Object.keys(row), STATUS_ALIASES[field.key]));
    const activeCameras = preparedCameraChecklist && !cameraTelemetry.inventoryKnown
      ? CAMERA_FIELDS.filter((field) => cameraState.cameraChecklistPresent.includes(field.key) && statuses[field.key] === 'online').length
      : getUnitCameraChecks(cameraState).filter((check) => check.present !== false && check.status === 'online').length;
    const expectedCameras = cameraSource === 'channels'
      ? cameraTelemetry.installedCount ?? camera?.expectedCameras ?? null : camera?.expectedCameras ?? null;
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
      expectedCameras,
      activeCameras,
      cameraSource,
      cameraChannels,
      cameraPresent: cameraState.cameraPresent,
      cameraLabels: cameraState.cameraLabels,
      cameraChecklistPresent: cameraState.cameraChecklistPresent,
      cameraAdditionalChecks: cameraState.cameraAdditionalChecks,
      cameraInventoryKnown: cameraTelemetry.inventoryKnown,
      overallStatus: readOverallStatus({ ...cameraState, updateStatus, expectedCameras }),
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
