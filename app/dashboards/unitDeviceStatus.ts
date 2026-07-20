export type DeviceDotStatus = 'online' | 'offline' | 'not_installed';
export type OverallStatus = 'healthy' | 'warning' | 'offline' | 'not_installed';

export type CameraChannel = 1 | 2 | 3 | 4 | 5;

export type UnitDeviceIndicators = {
  gps: DeviceDotStatus;
  mcr: DeviceDotStatus;
  mdvr: DeviceDotStatus;
  ivms: DeviceDotStatus;
  fatigueAi: DeviceDotStatus;
  intercom: DeviceDotStatus;
  cameras: Record<CameraChannel, DeviceDotStatus>;
  overall: OverallStatus;
};

export type UnitDeviceRowInput = {
  vehicleNo?: string | null;
  gps?: unknown;
  recording?: string | null;
  videoloss?: string | null;
};

const NAMED_CAMERA_MAP: Record<string, CameraChannel> = {
  front: 1,
  driver: 2,
  ai: 3,
  'rear right': 4,
  rearright: 4,
  'rear left': 5,
  rearleft: 5,
};

const CAMERA_CHANNELS: CameraChannel[] = [1, 2, 3, 4, 5];

export function extractTruckCode(vehicleNo: string): string {
  const trimmed = vehicleNo.trim();
  if (!trimmed) return '';
  const paren = trimmed.indexOf('(');
  if (paren > 0) return trimmed.slice(0, paren).trim();
  return trimmed;
}

export function parseGpsOnline(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  const raw = String(value).trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'online';
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseChannelTokens(raw: string | null | undefined): Set<CameraChannel> {
  const result = new Set<CameraChannel>();
  if (raw == null) return result;
  const text = String(raw).trim();
  if (!text) return result;
  const lowered = text.toLowerCase();
  if (lowered === 'none' || lowered === 'na' || lowered === 'n/a' || lowered === 'notrecording') {
    return result;
  }

  for (const part of text.split(',')) {
    const token = normalizeToken(part);
    if (!token || token === 'none' || token === 'na' || token === 'n/a') continue;

    const asNum = Number(token);
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 5) {
      result.add(asNum as CameraChannel);
      continue;
    }

    const mapped = NAMED_CAMERA_MAP[token];
    if (mapped) result.add(mapped);
  }
  return result;
}

export function parseCameraStatuses(
  recording: string | null | undefined,
  videoloss: string | null | undefined,
): Record<CameraChannel, DeviceDotStatus> {
  const recordingText = String(recording ?? '').trim();
  const notRecording = recordingText.toLowerCase() === 'notrecording';

  const recordingSet = notRecording ? new Set<CameraChannel>() : parseChannelTokens(recording);
  const lossSet = parseChannelTokens(videoloss);

  const cameras = {} as Record<CameraChannel, DeviceDotStatus>;
  for (const ch of CAMERA_CHANNELS) {
    if (notRecording) {
      cameras[ch] = 'offline';
      continue;
    }
    if (lossSet.has(ch)) {
      cameras[ch] = 'offline';
      continue;
    }
    if (recordingSet.has(ch)) {
      cameras[ch] = 'online';
      continue;
    }
    // Channel never mentioned in recording — treat as offline when other channels are listed,
    // otherwise offline as well (no not_installed signal for cameras on this sheet).
    cameras[ch] = 'offline';
  }
  return cameras;
}

export function deriveUnitDeviceIndicators(input: UnitDeviceRowInput): UnitDeviceIndicators {
  const vehicleNo = String(input.vehicleNo ?? '').trim();
  if (!vehicleNo) {
    const emptyCams = {} as Record<CameraChannel, DeviceDotStatus>;
    for (const ch of CAMERA_CHANNELS) emptyCams[ch] = 'not_installed';
    return {
      gps: 'not_installed',
      mcr: 'not_installed',
      mdvr: 'not_installed',
      ivms: 'not_installed',
      fatigueAi: 'not_installed',
      intercom: 'not_installed',
      cameras: emptyCams,
      overall: 'not_installed',
    };
  }

  const gpsOnline = parseGpsOnline(input.gps);
  const gps: DeviceDotStatus = gpsOnline ? 'online' : 'offline';
  const cameras = parseCameraStatuses(input.recording, input.videoloss);
  const fatigueAi = cameras[3];
  const intercom: DeviceDotStatus = 'online';

  let overall: OverallStatus;
  if (!gpsOnline) {
    overall = 'offline';
  } else {
    const cameraIssue = CAMERA_CHANNELS.some((ch) => cameras[ch] !== 'online');
    const fatigueIssue = fatigueAi !== 'online';
    overall = cameraIssue || fatigueIssue ? 'warning' : 'healthy';
  }

  return {
    gps,
    mcr: gps,
    mdvr: gps,
    ivms: gps,
    fatigueAi,
    intercom,
    cameras,
    overall,
  };
}

export function buildAbnormalDetails(
  indicators: UnitDeviceIndicators,
  lang: 'en' | 'th' = 'en',
): string {
  if (indicators.overall === 'not_installed') {
    return lang === 'th' ? 'ไม่ได้ติดตั้ง' : 'Not Installed';
  }
  if (indicators.overall === 'healthy') {
    return lang === 'th' ? 'ปกติ' : 'Normal';
  }

  const parts: string[] = [];
  const offlineLabel = lang === 'th' ? 'ผิดปกติ' : 'Offline';

  const pushIfOffline = (labelEn: string, labelTh: string, status: DeviceDotStatus) => {
    if (status === 'offline') {
      parts.push(`${lang === 'th' ? labelTh : labelEn}: ${offlineLabel}`);
    }
  };

  pushIfOffline('GPS', 'GPS', indicators.gps);
  pushIfOffline('MCR', 'MCR', indicators.mcr);
  pushIfOffline('MDVR', 'MDVR', indicators.mdvr);
  pushIfOffline('IVMS', 'IVMS', indicators.ivms);
  pushIfOffline('Fatigue AI', 'Fatigue AI', indicators.fatigueAi);
  // Intercom is always online by design — never listed.
  for (const ch of CAMERA_CHANNELS) {
    if (indicators.cameras[ch] === 'offline') {
      parts.push(
        lang === 'th' ? `กล้องเบอร์ ${ch}: Offline` : `Camera ${ch}: Offline`,
      );
    }
  }

  if (parts.length === 0) {
    return lang === 'th' ? 'ปกติ' : 'Normal';
  }
  return parts.join(lang === 'th' ? ' · ' : ' · ');
}

export type DeviceFilterKey =
  | 'gps'
  | 'mcr'
  | 'mdvr'
  | 'ivms'
  | 'fatigueAi'
  | 'intercom'
  | 'c1'
  | 'c2'
  | 'c3'
  | 'c4'
  | 'c5';

export function indicatorIsOffline(
  indicators: UnitDeviceIndicators,
  key: DeviceFilterKey,
): boolean {
  switch (key) {
    case 'gps':
      return indicators.gps === 'offline';
    case 'mcr':
      return indicators.mcr === 'offline';
    case 'mdvr':
      return indicators.mdvr === 'offline';
    case 'ivms':
      return indicators.ivms === 'offline';
    case 'fatigueAi':
      return indicators.fatigueAi === 'offline';
    case 'intercom':
      return indicators.intercom === 'offline';
    case 'c1':
      return indicators.cameras[1] === 'offline';
    case 'c2':
      return indicators.cameras[2] === 'offline';
    case 'c3':
      return indicators.cameras[3] === 'offline';
    case 'c4':
      return indicators.cameras[4] === 'offline';
    case 'c5':
      return indicators.cameras[5] === 'offline';
    default:
      return false;
  }
}

export function formatRelativeUpdated(
  date: Date | null,
  now: Date = new Date(),
  lang: 'en' | 'th' = 'en',
): string {
  if (!date || Number.isNaN(date.getTime())) {
    return lang === 'th' ? '—' : '—';
  }
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return lang === 'th' ? 'เมื่อกี้' : 'just now';
  if (minutes < 60) {
    return lang === 'th' ? `${minutes} นาทีที่แล้ว` : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return lang === 'th' ? `${hours} ชม.ที่แล้ว` : `${hours} hr ago`;
  }
  const days = Math.floor(hours / 24);
  return lang === 'th' ? `${days} วันที่แล้ว` : `${days} day${days === 1 ? '' : 's'} ago`;
}
