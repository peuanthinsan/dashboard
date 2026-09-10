import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import type { GoogleSheetRow } from './googleSheetParse';
import { isUnitApiUpdateStale } from './unitDeviceStatus';

export type UnitUpdateStatus = 'recent' | 'stale' | 'unknown';

export type UnitHealth = 'online' | 'offline' | 'unknown';
export type UnitOverallStatus = 'healthy' | 'warning' | 'offline' | 'unknown';
export const CAMERA_CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type UnitCameraChannel = typeof CAMERA_CHANNELS[number];
export type UnitCameraObservation = { key: string; label: string; lastSeen: string };
export type UnitCameraHistory = Record<string, UnitCameraObservation[]>;

/** Keep newer evidence when a refresh must fall back to in-session history. */
export function mergeUnitCameraHistory(previous: UnitCameraHistory, incoming: UnitCameraHistory): UnitCameraHistory {
  const merged = { ...previous };
  for (const [vehicle, observations] of Object.entries(incoming)) {
    const cameras = new Map((previous[vehicle] ?? []).map((item) => [item.key, item]));
    for (const observation of observations) {
      const old = cameras.get(observation.key);
      if (!old || Date.parse(observation.lastSeen) > Date.parse(old.lastSeen)) {
        cameras.set(observation.key, { ...observation, label: observation.label || old?.label || '' });
      }
    }
    merged[vehicle] = Array.from(cameras.values());
  }
  return merged;
}
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

function readCameraChannels(row: GoogleSheetRow, history: UnitCameraObservation[] = [], inferMissing = false, bsdLayout = false) {
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
  // A remembered physical label can resolve a portable alias (Front Camera →
  // Front) without inventing a customer-specific channel-to-position mapping.
  if (mask === null) for (const [value, target] of [[recordingRaw, recording], [lossRaw, loss]] as const) {
    for (const token of value.split(',')) {
      const key = monitorKey(token, bsdLayout);
      if (!key) continue;
      const matches = history.filter((item) => /^c[1-9]$/.test(item.key) && monitorKey(item.label, bsdLayout) === key);
      if (matches.length === 1) target.add(Number(matches[0].key.slice(1)) as UnitCameraChannel);
    }
  }
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
    const previous = history.find((item) => item.key === `c${channel}`);
    const reportTime = parseDate(readText(row, ['Date & time', 'Date & time 2', 'datatime', 'Data Time']));
    const omissionIsNewer = !previous || (reportTime !== null
      && reportTime.getTime() - BANGKOK_UTC_OFFSET_MS > Date.parse(previous.lastSeen));
    // Sheet-only fallback displays observed cameras; a count does not establish
    // a contiguous channel layout, and a blank shared column is not installation.
    present[channel] = mask !== null ? (mask & bit) !== 0
      : history.some((item) => item.key === `c${channel}`) || recording.has(channel) || namedLoss.has(channel) || (direct && isReportedValue(readText(row, aliases)));
    const name = channelNames[channel - 1]?.trim() || (mask === null
      ? [...recordingRaw.split(','), ...lossRaw.split(',')].find((value) => RAW_CAMERA_NAMES[normalizeLabel(value)] === channel)?.trim() ?? '' : '');
    names[channel] = /^ch\s*\d+$/i.test(name) ? '' : name || history.find((item) => item.key === `c${channel}`)?.label || '';
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
          : malformedHealth || recordMask !== null ? 'unknown' : recording.has(channel) ? 'online' : inferMissing && omissionIsNewer ? 'offline' : 'unknown';
      }
    } else {
      result[channel] = stopped || loss.has(channel) ? 'offline'
        : recording.has(channel) ? 'online' : inferMissing && omissionIsNewer ? 'offline' : 'unknown';
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
  const observed = CAMERA_CHANNELS.filter((channel) => (mask === null || (mask & (1 << (channel - 1))) !== 0)
    && (recording.has(channel) || (recordMask !== null && (recordMask & (1 << (channel - 1))) !== 0)))
    .map((channel) => ({ key: `c${channel}`, label: names[channel] }));
  return { channels: result, present, names, observed, representedChecklistKeys, inventoryKnown: mask !== null,
    installedCount: mask !== null ? CAMERA_CHANNELS.filter((channel) => (mask & (1 << (channel - 1))) !== 0).length : null };
}

export type UnitCheck = { key: string; en: string; th: string; status: UnitHealth; present?: boolean; displayStatus?: 'inactive'; physicalCamera?: boolean; missingFromRecording?: boolean };
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

type CameraMetadata = { key: string; fleet: string; expectedCameras: number | null; sourceIndex: number };
function readCameraMetadata(rows: GoogleSheetRow[]): CameraMetadata[] {
  return rows.flatMap((row, sourceIndex) => {
    const key = normalizeLabel(readText(row, VEHICLE_NO_ALIASES));
    if (!key || VEHICLE_NO_HEADERS.has(key)) return [];
    const raw = readText(row, ['CH']).trim();
    const count = Number(raw);
    return [{ key, sourceIndex, fleet: readText(row, FLEET_ALIASES).trim(),
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
  sourceIndex: number;
  metadataIndex?: number;
  cameraHistoryKey: string;
  cameraObservations: UnitCameraObservation[];
  cameraHistory?: UnitCameraObservation[];
  cameraRecordingValid: boolean;
  explicitCameraKeys: string[];
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
  monitorSource?: UnitMonitorSource;
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
  cameraHistory?: UnitCameraHistory,
): UnitRow[] {
  const normalizedScope = new Set(Array.from(scopeSet).map(normalizeLabel));
  const hasFleetColumn = rows.some((row) => hasAliasedColumn(Object.keys(row), FLEET_ALIASES));
  const hasUsernameColumn = rows.some((row) => hasAliasedColumn(Object.keys(row), USERNAME_ALIASES));
  const company = normalizeLabel(companyName ?? '');
  const companyUsernames = new Set([company, ...(COMPANY_USERNAME_ALIASES.get(company) ?? [])]);
  const metadata = readCameraMetadata(chRows);
  const nowWallClockMs = now.getTime() + BANGKOK_UTC_OFFSET_MS;
  const unitsByVehicle = new Map<string, UnitRow>();

  for (let sourceIndex = 0; sourceIndex < rows.length; sourceIndex++) {
    const row = rows[sourceIndex];
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

    const monitorSource = readUnitMonitorSource(row, companyName, camera?.expectedCameras ?? null);
    const rawPayload = readObject(findValue(row, ['raw_payload', 'Raw Payload']));
    const deviceId = readText(row, ['deviceid', 'Device ID', 'Device No', 'deviceno', 'imei']) || String(rawPayload.devIdno ?? '');
    // CH metadata may fail or change independently of the vehicle report. Only
    // source-reported fleet belongs in identity; the server also namespaces by
    // the dashboard's authorized fleet IDs when the source has no fleet field.
    const sourceFleet = normalizeLabel(primaryFleet) || usernames.find((name) => normalizedScope.has(name)) || '';
    const cameraHistoryKey = JSON.stringify([sourceFleet, vehicleKey, normalizeLabel(deviceId)]);
    const history = cameraHistory?.[cameraHistoryKey] ?? [];
    // Explicit equipment removal overrides learned inventory. Counts alone do
    // not establish a contiguous channel layout.
    const allowedHistory = monitorSource.expectedPositions === 0 ? [] : history.filter((item) =>
      !monitorSource.requiredKeys || monitorSource.requiredKeys.includes(item.key)
      || monitorSource.requiredKeys.includes(monitorKey(item.label, monitorSource.bsdLayout) ?? ''));
    const recordingRaw = readText(row, ['recording']);
    const recordingTokens = recordingRaw.split(',').map(normalizeLabel).filter(Boolean);
    const rawStatus = readObject(findValue(row, ['lastStatusJson', 'Last Status JSON']) ?? rawPayload.lastStatusJson);
    const rawModule = rawStatus.module && typeof rawStatus.module === 'object' ? rawStatus.module as Record<string, unknown> : {};
    const cameraRecordingValid = parseCameraMask(rawModule.record) !== null || normalizeLabel(recordingRaw) === 'notrecording'
      || (recordingTokens.length > 0 && recordingTokens.every((token) => isReportedValue(token)
        && (monitorKey(token, monitorSource.bsdLayout) !== null || Object.hasOwn(RAW_CAMERA_NAMES, token))));
    const freshRecording = monitorGpsStatus(dataTime, now) === 'online' && cameraRecordingValid;
    const statuses = readDeviceStatuses(row);
    const cameraTelemetry = readCameraChannels(row, allowedHistory, cameraHistory !== undefined && freshRecording, monitorSource.bsdLayout);
    const observedAt = parseDate(dataTime);
    const validObservedAt = observedAt && observedAt.getTime() <= nowWallClockMs
      ? new Date(observedAt.getTime() - BANGKOK_UTC_OFFSET_MS).toISOString() : null;
    const mappedNames = new Set(cameraTelemetry.observed.map((item) => monitorKey(item.label, monitorSource.bsdLayout)));
    const namedObserved = cameraRecordingValid && !cameraTelemetry.inventoryKnown ? recordingTokens.flatMap((token) => {
      const key = monitorKey(token, monitorSource.bsdLayout);
      return key && MONITOR_CAMERA_KEYS.has(key) && !mappedNames.has(key) ? [{ key, label: token }] : [];
    }) : [];
    const cameraObservations = validObservedAt ? [...(cameraRecordingValid ? cameraTelemetry.observed : []), ...namedObserved]
      .map((item) => ({ ...item, lastSeen: validObservedAt })) : [];
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
      sourceIndex,
      metadataIndex: camera?.sourceIndex,
      cameraHistoryKey,
      cameraObservations,
      cameraHistory: cameraHistory === undefined ? undefined : allowedHistory,
      cameraRecordingValid,
      explicitCameraKeys: CAMERA_CHANNELS.filter((channel) => hasAliasedColumn(Object.keys(row),
        [`Camera CH${channel}`, `CH${channel}`, `C${channel}`, `Camera ${channel}`, `Camera${channel}`])).map((channel) => `c${channel}`),
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
      monitorSource,
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

// The reference's nine-position installation is an equipment checklist: eight
// named cameras plus Seat Vibrator. It is not a nine-channel camera roster.
const MONITOR_EQUIPMENT = [
  { key: 'ch1Ai', en: 'AI', th: 'AI', aliases: ['CH1 AI', 'AI Camera', 'AI'] },
  { key: 'seatVibrator', en: 'Seat Vibrator', th: 'เบาะสั่น', aliases: ['Seat Vibrator'] },
  { key: 'reverseBsd', en: 'Reverse BSD', th: 'BSD ด้านหลัง', aliases: ['Reverse BSD', 'Rear BSD'] },
  { key: 'front', en: 'Front', th: 'กล้องหน้า', aliases: ['Front', 'Front Camera'] },
  { key: 'frontBsd', en: 'Front BSD', th: 'BSD ด้านหน้า', aliases: ['Front BSD'] },
  { key: 'rearRight', en: 'Rear Right', th: 'ด้านหลังขวา', aliases: ['Rear Right', 'RearRight'] },
  { key: 'rearLeft', en: 'Rear Left', th: 'ด้านหลังซ้าย', aliases: ['Rear Left', 'RearLeft'] },
  { key: 'leftBsd', en: 'Left BSD', th: 'BSD ด้านซ้าย', aliases: ['Left BSD'] },
  { key: 'rightBsd', en: 'Right BSD', th: 'BSD ด้านขวา', aliases: ['Right BSD'] },
] as const;
const MONITOR_EXTRAS = [
  { key: 'cabin', en: 'Cabin', th: 'ห้องโดยสาร', aliases: ['Cabin'] },
  { key: 'storage', en: 'Storage', th: 'พื้นที่จัดเก็บ', aliases: STATUS_ALIASES.storage },
  { key: 'intercom', en: 'Intercom', th: 'อินเตอร์คอม', aliases: ['Intercom'] },
  ...DEVICE_FIELDS.filter((field) => ['mcr', 'mdvr', 'ivms', 'fatigueAi'].includes(field.key))
    .map((field) => ({ ...field, aliases: STATUS_ALIASES[field.key] })),
];
const MONITOR_CAMERA_KEYS = new Set<string>(MONITOR_EQUIPMENT.filter((field) => field.key !== 'seatVibrator').map((field) => field.key));
type UnitMonitorSource = {
  bsdLayout: boolean;
  expectedPositions: number | null;
  requiredKeys: string[] | null;
  values: Record<string, string>;
  customers: string[];
  geofence: boolean | null;
};

function monitorKey(value: string, bsdLayout: boolean): string | null {
  const token = normalizeLabel(value);
  if (bsdLayout && ['reverse 1', 'rear bsd'].includes(token)) return 'reverseBsd';
  const named = [...MONITOR_EQUIPMENT, ...MONITOR_EXTRAS].find((field) => field.aliases.some((alias) => normalizeLabel(alias) === token));
  if (named) return named.key;
  const numeric = /^(?:camera\s*|ch\s*|c)?([1-9])$/.exec(token);
  return numeric ? `c${numeric[1]}` : null;
}

function readUnitMonitorSource(row: GoogleSheetRow, company: string | null | undefined, expected: number | null): UnitMonitorSource {
  const labels = Object.keys(row);
  const customers = Array.from(new Map(readText(row, USERNAME_ALIASES).split(',').map((name) => name.trim())
    .filter((name) => name && normalizeLabel(name) !== 'songdeeapi').map((name) => [normalizeLabel(name), name])).values());
  const bsdLayout = normalizeLabel(company ?? '') === 'bigth'
    || customers.some((name) => normalizeLabel(name) === 'bigth');
  const values: Record<string, string> = {};
  for (const field of [...MONITOR_EQUIPMENT, ...MONITOR_EXTRAS,
    { key: 'statusAi', aliases: STATUS_ALIASES.statusAi }, { key: 'deviceStatus', aliases: STATUS_ALIASES.deviceStatus }]) {
    if (hasAliasedColumn(labels, [...field.aliases])) values[field.key] = readText(row, [...field.aliases]);
  }
  const requiredText = readText(row, ['Required Equipment', 'Equipment Positions', 'Installed Equipment']);
  const requiredTokens = requiredText.split(/[,;]/).map((value) => value.trim()).filter(Boolean);
  const requiredKeys = requiredTokens.length ? Array.from(new Set(requiredTokens.map((value) => monitorKey(value, bsdLayout)).filter((key): key is string => key !== null))) : null;
  const explicitCount = readText(row, ['Expected Positions', 'Required Position Count', 'Equipment Count']);
  const parsedCount = /^\d+$/.test(explicitCount.trim()) ? Number(explicitCount) : null;
  const expectedPositions = requiredKeys !== null
    // Unknown configuration labels remain in the denominator, not silently complete.
    ? new Set(requiredTokens.map((token) => monitorKey(token, bsdLayout) ?? normalizeLabel(token))).size
    : parsedCount !== null && Number.isSafeInteger(parsedCount) ? parsedCount : expected;
  const geo = normalizeLabel(readText(row, ['In Geofence', 'Geofence Status', 'geofence']));
  const geofence = ['true', '1', 'yes', 'inside', 'in geofence'].includes(geo) ? true
    : ['false', '0', 'no', 'outside', 'out of geofence'].includes(geo) ? false : null;
  return { bsdLayout, expectedPositions, requiredKeys, values, customers, geofence };
}

export type UnitMonitorRow = {
  unit: UnitRow;
  gpsStatus: UnitHealth;
  overallStatus: UnitOverallStatus;
  statusAi: UnitHealth;
  deviceStatus: UnitHealth;
  checks: UnitCheck[];
  requiredPositions: number | null;
  activePositions: number;
  installation: 'complete' | 'partial' | 'unknown';
  geofence: 'reported' | 'inferred' | null;
  duplicateRecording: boolean;
  customers: string[];
};

function monitorGpsStatus(dataTime: string, now: Date): UnitHealth {
  const time = parseDate(dataTime);
  if (!time || !Number.isFinite(now.getTime())) return 'unknown';
  const age = now.getTime() + BANGKOK_UTC_OFFSET_MS - time.getTime();
  if (!Number.isFinite(age) || age < 0) return 'unknown';
  return age <= 10 * 60_000 ? 'online' : 'offline';
}

const isMonitorCamera = (key: string) => MONITOR_CAMERA_KEYS.has(key) || /^c[1-9]$/.test(key);
const isMonitorCameraCheck = (check: UnitCheck) => check.physicalCamera === true || isMonitorCamera(check.key);

function monitorStorageStatus(value: string): UnitHealth {
  const statuses = value.split(',').map((part) => readUnitHealth(part));
  return statuses.some((status) => status === 'offline') ? 'offline'
    : statuses.every((status) => status === 'online') ? 'online' : 'unknown';
}

/** Source-backed reference view, separate from retained raw/legacy diagnostics. */
export function buildUnitMonitorRows(units: UnitRow[], now: Date): UnitMonitorRow[] {
  return units.map((unit) => {
    const source = unit.monitorSource ?? { bsdLayout: false, expectedPositions: unit.expectedCameras,
      requiredKeys: null, values: {}, customers: [], geofence: null };
    const tokens = unit.recording.split(',').map(normalizeLabel).filter((token) => isReportedValue(token));
    const lossTokens = unit.videoLoss.split(',').map(normalizeLabel).filter((token) => isReportedValue(token));
    const recording = new Set(tokens.map((token) => monitorKey(token, source.bsdLayout)).filter((key): key is string => key !== null));
    const loss = new Set(lossTokens.map((token) => monitorKey(token, source.bsdLayout)).filter((key): key is string => key !== null));
    const stopped = normalizeLabel(unit.recording) === 'notrecording';
    const rawCameras = getUnitCameraChecks(unit).filter((check) => check.present !== false && /^c[1-9]$/.test(check.key));
    // A portable literal name can establish equivalence; a numeric position cannot.
    const rawNames = rawCameras.map((check) => monitorKey(check.en, source.bsdLayout));
    const rawByKey = new Map<string, UnitCheck>();
    rawCameras.forEach((check, index) => {
      const name = rawNames[index];
      const key = !source.requiredKeys?.includes(check.key) && name && (MONITOR_CAMERA_KEYS.has(name) || name === 'cabin')
        && rawNames.filter((other) => other === name).length === 1 ? name : check.key;
      rawByKey.set(key, { ...check, key, physicalCamera: true });
    });
    const requiredPositions = source.expectedPositions ?? (unit.cameraInventoryKnown ? unit.expectedCameras : source.bsdLayout ? 9 : null);
    const requiredKeys = source.requiredKeys ?? (source.bsdLayout && requiredPositions === 9
      ? MONITOR_EQUIPMENT.map((field) => field.key) : null);
    const required = new Set(requiredKeys ?? []);
    const useNamedLists = !unit.cameraInventoryKnown;
    const knownRecording = useNamedLists && (stopped || Array.from(recording).some((key) => MONITOR_CAMERA_KEYS.has(key)));
    const rememberedNames = new Set(!unit.cameraInventoryKnown ? unit.cameraHistory?.map((item) => item.key) ?? [] : []);
    const checks: UnitCheck[] = MONITOR_EQUIPMENT.map((field) => {
      const explicit = Object.hasOwn(source.values, field.key);
      const raw = rawByKey.get(field.key);
      const numericEquivalent = rawCameras.find((check) => source.requiredKeys?.includes(check.key)
        && monitorKey(check.en, source.bsdLayout) === field.key);
      if (!required.has(field.key) && numericEquivalent && (!explicit || readUnitHealth(source.values[field.key]) === numericEquivalent.status)) {
        return { key: field.key, en: field.en, th: field.th, present: false, status: 'unknown' };
      }
      const listedOnline = (useNamedLists || field.key === 'seatVibrator') && recording.has(field.key);
      const listedOffline = (useNamedLists || field.key === 'seatVibrator') && loss.has(field.key);
      const forced = field.key === 'seatVibrator' && !explicit && !recording.has(field.key) && !loss.has(field.key);
      const present = forced || required.has(field.key) || raw !== undefined || listedOnline || listedOffline || rememberedNames.has(field.key)
        || (explicit && isReportedValue(source.values[field.key]));
      const status: UnitHealth = explicit ? readUnitHealth(source.values[field.key]) : forced ? 'online'
        : raw ? raw.status : listedOffline ? 'offline' : listedOnline ? 'online'
          : required.has(field.key) && knownRecording ? 'offline' : 'unknown';
      return { key: field.key, en: field.en, th: field.th, present, status, physicalCamera: raw?.physicalCamera };
    });
    for (const raw of Array.from(rawByKey.values())) if (/^c[1-9]$/.test(raw.key)) checks.push(raw);
    // Explicit numeric configuration can identify a missing camera even without
    // an installed mask; it does not assign that camera a BSD position.
    for (const key of Array.from(required)) if (/^c[1-9]$/.test(key) && !checks.some((check) => check.key === key)) {
      checks.push({ key, en: `Camera ${key.slice(1)}`, th: `กล้อง ${key.slice(1)}`, present: true,
        status: stopped || loss.has(key) ? 'offline' : recording.has(key) ? 'online' : 'unknown' });
    }
    for (const field of MONITOR_EXTRAS) {
      const explicit = Object.hasOwn(source.values, field.key);
      const raw = rawByKey.get(field.key);
      const numericEquivalent = rawCameras.find((check) => source.requiredKeys?.includes(check.key)
        && monitorKey(check.en, source.bsdLayout) === field.key);
      // A Cabin label may describe an explicitly numbered VSS camera. Keep its
      // one physical requirement and fault, rather than adding an assumed twin.
      if (field.key === 'cabin' && !required.has(field.key) && numericEquivalent
        && (!explicit || readUnitHealth(source.values[field.key]) === numericEquivalent.status)) continue;
      const status = field.key === 'intercom' ? 'online'
        : field.key === 'storage' ? monitorStorageStatus(explicit ? source.values[field.key] : unit.storageRaw)
          : explicit ? readUnitHealth(source.values[field.key]) : raw ? raw.status
            : useNamedLists && loss.has(field.key) ? 'offline' : useNamedLists && recording.has(field.key) ? 'online'
              : field.key === 'cabin' ? 'online' : unit.statuses[field.key as UnitDeviceKey] ?? 'unknown';
      checks.push({ key: field.key, en: field.en, th: field.th, status, physicalCamera: raw?.physicalCamera,
        present: ['cabin', 'storage', 'intercom'].includes(field.key) || required.has(field.key)
          || (explicit && isReportedValue(source.values[field.key])) || status !== 'unknown' });
    }
    // Historical presence and current recording health are separate facts.
    // Preserve explicit component values/masks; infer omission only from a
    // complete fresh list, never merely from elapsed time or a missing report.
    if (unit.cameraHistory !== undefined) {
      const freshReport = monitorGpsStatus(unit.dataTime, now) === 'online';
      const fresh = freshReport && unit.cameraRecordingValid;
      for (const check of checks) {
        if (check.present === false || !isMonitorCameraCheck(check)) continue;
        const equivalent = rawCameras.find((raw) => raw.key === check.key
          || (rawNames.filter((name) => name === check.key).length === 1 && monitorKey(raw.en, source.bsdLayout) === check.key));
        const explicit = Object.hasOwn(source.values, check.key) || unit.explicitCameraKeys.includes(equivalent?.key ?? check.key);
        if (explicit) continue;
        // A fresh, explicit loss is useful even if the Recording cell is blank.
        // It does not establish installation of unused numeric inputs.
        if (freshReport && ((!unit.cameraInventoryKnown && (loss.has(check.key) || loss.has(equivalent?.key ?? check.key)))
          || (unit.cameraInventoryKnown && check.status === 'offline' && !unit.cameraRecordingValid))) {
          check.status = 'offline';
          continue;
        }
        const observed = unit.cameraObservations.some((item) => item.key === check.key || item.key === equivalent?.key);
        const previous = unit.cameraHistory.filter((item) => item.key === check.key || item.key === equivalent?.key)
          .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen))[0];
        const reportTime = parseDate(unit.dataTime);
        const omissionIsNewer = !previous || (reportTime !== null
          && reportTime.getTime() - BANGKOK_UTC_OFFSET_MS > Date.parse(previous.lastSeen));
        if (!fresh) check.status = 'unknown';
        else if (!unit.cameraInventoryKnown && (previous || source.requiredKeys?.includes(check.key))
          && !observed && !loss.has(check.key) && !loss.has(equivalent?.key ?? check.key)) {
          check.status = omissionIsNewer ? 'offline' : 'unknown';
          check.missingFromRecording = omissionIsNewer;
        }
      }
    }
    const installed = checks.filter((check) => check.present !== false && (requiredKeys !== null ? required.has(check.key) : isMonitorCameraCheck(check)));
    const activePositions = installed.filter((check) => check.status === 'online').length;
    const installation = requiredPositions === null || installed.length !== requiredPositions || installed.some((check) => check.status === 'unknown')
      ? 'unknown' : activePositions === requiredPositions ? 'complete' : 'partial';
    const cameras = installed.filter(isMonitorCameraCheck);
    const geofence = source.geofence === true ? 'reported'
      : source.geofence === null && !cameras.some((check) => check.missingFromRecording) && requiredPositions !== null && installed.length === requiredPositions
        && cameras.length > 0 && cameras.every((check) => check.status === 'offline') ? 'inferred' : null;
    if (geofence) for (const check of checks) if (isMonitorCameraCheck(check) && check.present !== false) check.displayStatus = 'inactive';
    const statusAi = Object.hasOwn(source.values, 'statusAi') ? readUnitHealth(source.values.statusAi)
      : /\bai\s+not\s+working\b/i.test(unit.lastAiAlert) ? 'offline' : isReportedValue(unit.lastAiAlert) ? 'online' : 'unknown';
    const deviceStatus = Object.hasOwn(source.values, 'deviceStatus') ? readUnitHealth(source.values.deviceStatus)
      : checks.find((check) => check.key === 'storage')?.status ?? 'unknown';
    const monitor: UnitMonitorRow = { unit, gpsStatus: monitorGpsStatus(unit.dataTime, now), overallStatus: 'unknown', statusAi, deviceStatus, checks,
      requiredPositions, activePositions, installation, geofence,
      duplicateRecording: tokens.length !== new Set(tokens).size, customers: source.customers };
    monitor.overallStatus = monitor.gpsStatus === 'offline' || deviceStatus === 'offline' ? 'offline'
      : getUnitMonitorDamage(monitor).length > 0 ? 'warning'
        : monitor.gpsStatus === 'unknown' || installation !== 'complete' ? 'unknown' : 'healthy';
    return monitor;
  });
}

/** Equipment matrix columns retain reference order and stable raw-position names. */
export function getUnitMonitorColumns(rows: UnitMonitorRow[]): Array<{ key: string; en: string; th: string }> {
  const available = new Map(rows.flatMap((row) => row.checks.filter((check) => check.present !== false)).map((check) => [check.key, check]));
  const ordered = [...MONITOR_EQUIPMENT, ...MONITOR_EXTRAS].filter((field) => available.has(field.key))
    .map(({ key, en, th }) => ({ key, en, th }));
  const raw = CAMERA_CHANNELS.filter((channel) => available.has(`c${channel}`))
    .map((channel) => ({ key: `c${channel}`, en: `Camera ${channel}`, th: `กล้อง ${channel}` }));
  const extrasIndex = ordered.findIndex((field) => field.key === 'cabin');
  ordered.splice(extrasIndex < 0 ? ordered.length : extrasIndex, 0, ...raw);
  return ordered;
}

/** Geofence affects camera diagnostics; unrelated reported failures stay visible. */
export function getUnitMonitorDamage(row: UnitMonitorRow): UnitCheck[] {
  const issues = row.checks.filter((check) => check.present !== false && check.status === 'offline'
    && (!row.geofence || !isMonitorCameraCheck(check))
    && (check.key !== 'reverseBsd' || (row.gpsStatus === 'online' && isReportedValue(row.unit.speed) && Number(row.unit.speed) > 0)));
  if (row.statusAi === 'offline') issues.push({ key: 'statusAi', en: 'Status AI', th: 'สถานะ AI', status: 'offline' });
  // NonExist storage is already one storage failure, not two damage entries.
  if (row.deviceStatus === 'offline' && !issues.some((check) => check.key === 'storage')) {
    issues.push({ key: 'deviceStatus', en: 'Device Status', th: 'สถานะอุปกรณ์', status: 'offline' });
  }
  return issues;
}
