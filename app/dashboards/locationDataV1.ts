import { findValue, parseDate } from './dashboardDataUtils';
import type { GoogleSheetRow } from './googleSheetParse';

export type Coordinates = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

export type LocationRecord = {
  /** Original position in the sheet response, retained as a stable sort tie-breaker. */
  sourceIndex: number;
  /** Original values are retained for exports and fields the dashboard does not render. */
  sourceRow: GoogleSheetRow;
  vehicleNo: string;
  trackTimeRaw: string;
  trackTime: Date | null;
  latitude: number | null;
  longitude: number | null;
  gpsStatus: string;
  location: string;
  speedKph: number | null;
  ignition: string;
  /** `null` means the source value was missing or not a recognized on/off value. */
  ignitionOn: boolean | null;
  driverName: string;
  faceId: string;
  pollingMode: string;
  fuelbar: number | null;
  updatedTimeRaw: string;
  updatedTime: Date | null;
  mapHref: string | null;
};

export type LocationSummary = {
  recordCount: number;
  uniqueVehicleCount: number;
  uniqueDriverCount: number;
  uniqueLocationCount: number;
  maxSpeedKph: number;
  averageSpeedKph: number;
  movingRecordCount: number;
  movingDurationMs: number;
  ignitionOnDurationMs: number;
  trackedDurationMs: number;
  totalDistanceKm: number;
};

export type LocationContinuityMode = 'route' | 'telemetry';

export const LOCATION_FIELD_ALIASES: Record<string, string[]> = {
  vehicleNo: [
    'Vehicle No',
    'Vehicle No.',
    'VehicleNo',
    'Vehicle Number',
    'Vehicle',
    'Plate',
    'License Plate',
    'vehicle_no',
  ],
  trackTime: [
    'Track Time',
    'TrackTime',
    'Track Date Time',
    'GPS Time',
    'Date Time',
    'DateTime',
    'Timestamp',
    'track_time',
  ],
  latitude: ['Latitude', 'Lat', 'GPS Latitude', 'gps_latitude'],
  longitude: ['Longitude', 'Lng', 'Lon', 'Long', 'GPS Longitude', 'gps_longitude'],
  gpsStatus: ['GPS Status', 'GPSStatus', 'GPS', 'GPS Signal', 'GPS State', 'gps_status'],
  location: ['Location', 'Address', 'Landmark', 'Place'],
  speed: [
    'Speed',
    'Speed (km/h)',
    'Speed(km/h)',
    'Speed KPH',
    'Speed km/h',
    'Vehicle Speed',
    'Spd',
    'speed_kph',
  ],
  ignition: ['Ignition', 'Ignition Status', 'ACC', 'ACC Status', 'Engine Status'],
  driverName: ['Driver Name', 'DriverName', 'Driver', 'driver_name'],
  faceId: ['Face ID', 'FaceID', 'Face Id', 'Driver Face ID', 'face_id'],
  pollingMode: ['Polling Mode', 'PollingMode', 'Polling', 'Mode', 'polling_mode'],
  fuelbar: ['Fuelbar', 'Fuel Bar', 'Fuelbar (%)', 'Fuel Level', 'Fuel', 'fuel_bar'],
  updatedTime: [
    'Updated Time',
    'UpdatedTime',
    'Update Time',
    'Last Updated Time',
    'Last Update',
    'LastUpdatedTime',
    'updated_time',
  ],
};

/** Intervals beyond this are treated as tracking outages rather than observed time. */
export const MAX_LOCATION_INTERVAL_MS = 30 * 60 * 1_000;
/** Used only to discard impossible coordinate jumps from the distance estimate. */
export const MAX_PLAUSIBLE_LOCATION_SPEED_KPH = 200;
const DISTANCE_TOLERANCE_KM = 0.5;
const EARTH_RADIUS_KM = 6_371.0088;

function toText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function hasCellValue(value: unknown): boolean {
  return value != null && (typeof value !== 'string' || value.trim() !== '');
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null || typeof value === 'boolean') return null;

  const raw = String(value).trim().replace(/,/g, '');
  if (!raw) return null;

  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;

  // Accept common display values such as "58 km/h" and "72%", but never
  // search arbitrary text for a number (for example, an address).
  const leadingNumber = raw.match(/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/i)?.[0];
  if (!leadingNumber) return null;
  const parsed = Number(leadingNumber);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLatitude(value: unknown): number | null {
  const latitude = parseFiniteNumber(value);
  return latitude != null && latitude >= -90 && latitude <= 90 ? latitude : null;
}

function parseLongitude(value: unknown): number | null {
  const longitude = parseFiniteNumber(value);
  return longitude != null && longitude >= -180 && longitude <= 180 ? longitude : null;
}

function parseSpeed(value: unknown): number | null {
  const speed = parseFiniteNumber(value);
  return speed != null && speed >= 0 ? speed : null;
}

function parseIgnition(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const normalized = toText(value).toLocaleLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;

  const numeric = Number(normalized);
  if (numeric === 1) return true;
  if (numeric === 0) return false;

  if (
    ['on', 'true', 'yes', 'y', 'running', 'engine on', 'ignition on', 'acc on', 'เปิด'].includes(
      normalized,
    )
  ) {
    return true;
  }
  if (
    ['off', 'false', 'no', 'n', 'stopped', 'engine off', 'ignition off', 'acc off', 'ปิด', 'ดับ'].includes(
      normalized,
    )
  ) {
    return false;
  }
  return null;
}

function validCoordinates(value: Coordinates): value is { latitude: number; longitude: number } {
  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

/** Return a canonical Google Maps search link, or `null` for unusable coordinates. */
export function buildLocationMapHref(record: Coordinates): string | null {
  if (!validCoordinates(record)) return null;
  const query = encodeURIComponent(`${record.latitude},${record.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Great-circle distance between two WGS84 coordinate pairs. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number | null {
  if (!validCoordinates(a) || !validCoordinates(b)) return null;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const haversine = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const centralAngle = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
  return EARTH_RADIUS_KM * centralAngle;
}

export function normalizeLocationRows(rows: GoogleSheetRow[]): LocationRecord[] {
  const records: LocationRecord[] = [];

  rows.forEach((sourceRow, sourceIndex) => {
    const vehicleNoValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.vehicleNo!);
    const trackTimeValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.trackTime!);
    const latitudeValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.latitude!);
    const longitudeValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.longitude!);
    const gpsStatusValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.gpsStatus!);
    const locationValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.location!);
    const speedValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.speed!);
    const ignitionValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.ignition!);
    const driverNameValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.driverName!);
    const faceIdValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.faceId!);
    const pollingModeValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.pollingMode!);
    const fuelbarValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.fuelbar!);
    const updatedTimeValue = findValue(sourceRow, LOCATION_FIELD_ALIASES.updatedTime!);
    const values = [
      vehicleNoValue,
      trackTimeValue,
      latitudeValue,
      longitudeValue,
      gpsStatusValue,
      locationValue,
      speedValue,
      ignitionValue,
      driverNameValue,
      faceIdValue,
      pollingModeValue,
      fuelbarValue,
      updatedTimeValue,
    ];

    // Sheets often contain formatting-only trailing rows. They are not records.
    if (!values.some(hasCellValue)) return;

    const latitude = parseLatitude(latitudeValue);
    const longitude = parseLongitude(longitudeValue);
    const trackTimeRaw = toText(trackTimeValue);
    const updatedTimeRaw = toText(updatedTimeValue);
    const coordinates = { latitude, longitude };

    records.push({
      sourceIndex,
      sourceRow,
      vehicleNo: toText(vehicleNoValue),
      trackTimeRaw,
      trackTime: parseDate(trackTimeValue),
      latitude,
      longitude,
      gpsStatus: toText(gpsStatusValue),
      location: toText(locationValue),
      speedKph: parseSpeed(speedValue),
      ignition: toText(ignitionValue),
      ignitionOn: parseIgnition(ignitionValue),
      driverName: toText(driverNameValue),
      faceId: toText(faceIdValue),
      pollingMode: toText(pollingModeValue),
      fuelbar: parseFiniteNumber(fuelbarValue),
      updatedTimeRaw,
      updatedTime: parseDate(updatedTimeValue),
      mapHref: buildLocationMapHref(coordinates),
    });
  });

  return records.sort((a, b) => {
    const aTime = a.trackTime?.getTime();
    const bTime = b.trackTime?.getTime();
    if (aTime == null && bTime != null) return 1;
    if (aTime != null && bTime == null) return -1;
    if (aTime != null && bTime != null && aTime !== bTime) return bTime - aTime;
    return a.sourceIndex - b.sourceIndex;
  });
}

function uniqueCount(values: string[]): number {
  return new Set(
    values
      .map((value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase())
      .filter(Boolean),
  ).size;
}

function vehicleKey(record: LocationRecord): string {
  return record.vehicleNo.trim().toLocaleLowerCase();
}

function visualTimestamp(record: LocationRecord): number | null {
  return record.trackTime?.getTime() ?? record.updatedTime?.getTime() ?? null;
}

function isPlausibleDistance(distanceKm: number, intervalMs: number): boolean {
  const maximumDistanceKm =
    (MAX_PLAUSIBLE_LOCATION_SPEED_KPH * intervalMs) / 3_600_000 + DISTANCE_TOLERANCE_KM;
  return distanceKm <= maximumDistanceKm;
}

/**
 * Assign each visible sample to a continuous per-vehicle segment based on the
 * unfiltered record stream. Hidden samples, outages, invalid coordinates, and
 * implausible jumps start a new segment instead of creating a synthetic line.
 */
export function buildLocationContinuityGroups(
  records: LocationRecord[],
  visibleRecords: LocationRecord[] = records,
  mode: LocationContinuityMode = 'route',
): Map<number, string> {
  const visibleIds = new Set(visibleRecords.map((record) => record.sourceIndex));
  const recordsByVehicle = new Map<string, LocationRecord[]>();
  const groups = new Map<number, string>();

  for (const record of records) {
    const key = vehicleKey(record);
    const timestamp = visualTimestamp(record);
    if (!key || timestamp == null) {
      if (visibleIds.has(record.sourceIndex) && timestamp != null) {
        groups.set(record.sourceIndex, `anonymous:${record.sourceIndex}`);
      }
      continue;
    }
    const vehicleRecords = recordsByVehicle.get(key) ?? [];
    vehicleRecords.push(record);
    recordsByVehicle.set(key, vehicleRecords);
  }

  for (const [key, vehicleRecords] of Array.from(recordsByVehicle.entries())) {
    vehicleRecords.sort((a, b) => {
      const timeDifference = visualTimestamp(a)! - visualTimestamp(b)!;
      return timeDifference || a.sourceIndex - b.sourceIndex;
    });

    let segment = 0;
    let previous: LocationRecord | null = null;
    for (const record of vehicleRecords) {
      const hasRouteCoordinates = validCoordinates(record);
      const eligible = mode === 'telemetry' || hasRouteCoordinates;
      if (!eligible) {
        previous = null;
        continue;
      }

      const intervalMs = previous
        ? visualTimestamp(record)! - visualTimestamp(previous)!
        : 0;
      const intervalIsContinuous =
        previous != null &&
        visibleIds.has(previous.sourceIndex) &&
        intervalMs > 0 &&
        intervalMs <= MAX_LOCATION_INTERVAL_MS;
      const routeIsContinuous =
        mode === 'telemetry' ||
        (intervalIsContinuous &&
          (() => {
            const distanceKm = haversineDistanceKm(previous!, record);
            return distanceKm != null && isPlausibleDistance(distanceKm, intervalMs);
          })());

      if (visibleIds.has(record.sourceIndex)) {
        if (!intervalIsContinuous || !routeIsContinuous) segment += 1;
        groups.set(record.sourceIndex, `${key}:${segment}`);
      }
      previous = record;
    }
  }

  return groups;
}

/**
 * Summarize normalized samples. Durations and distance are accumulated only
 * between chronological samples from the same identified vehicle. The earlier
 * sample's speed/ignition describes the following interval.
 *
 * `continuityRecords` can be the unfiltered data set. When supplied, intervals
 * are counted only when both records were adjacent for that vehicle before UI
 * filters were applied. This prevents a categorical/search filter from joining
 * two samples that were separated by a filtered-out point.
 */
export function summarizeLocationRecords(
  records: LocationRecord[],
  continuityRecords: LocationRecord[] = records,
): LocationSummary {
  let speedSampleCount = 0;
  let speedTotal = 0;
  let maxSpeedKph = 0;
  let movingRecordCount = 0;
  let movingDurationMs = 0;
  let ignitionOnDurationMs = 0;
  let trackedDurationMs = 0;
  let totalDistanceKm = 0;
  const recordsByVehicle = new Map<string, LocationRecord[]>();
  const continuityByVehicle = new Map<string, LocationRecord[]>();
  const continuousIntervals = new Set<string>();

  for (const record of continuityRecords) {
    const key = vehicleKey(record);
    if (!key || !record.trackTime) continue;
    const vehicleRecords = continuityByVehicle.get(key) ?? [];
    vehicleRecords.push(record);
    continuityByVehicle.set(key, vehicleRecords);
  }

  for (const vehicleRecords of Array.from(continuityByVehicle.values())) {
    vehicleRecords.sort((a, b) => {
      const timeDifference = a.trackTime!.getTime() - b.trackTime!.getTime();
      return timeDifference || a.sourceIndex - b.sourceIndex;
    });
    for (let index = 1; index < vehicleRecords.length; index += 1) {
      const previous = vehicleRecords[index - 1]!;
      const current = vehicleRecords[index]!;
      continuousIntervals.add(`${previous.sourceIndex}:${current.sourceIndex}`);
    }
  }

  for (const record of records) {
    if (record.speedKph != null && Number.isFinite(record.speedKph) && record.speedKph >= 0) {
      speedSampleCount += 1;
      speedTotal += record.speedKph;
      maxSpeedKph = Math.max(maxSpeedKph, record.speedKph);
      if (record.speedKph > 0) movingRecordCount += 1;
    }

    const key = vehicleKey(record);
    // Connecting anonymous samples could accidentally join different vehicles.
    if (!key || !record.trackTime) continue;
    const vehicleRecords = recordsByVehicle.get(key) ?? [];
    vehicleRecords.push(record);
    recordsByVehicle.set(key, vehicleRecords);
  }

  for (const vehicleRecords of Array.from(recordsByVehicle.values())) {
    vehicleRecords.sort((a, b) => {
      const timeDifference = a.trackTime!.getTime() - b.trackTime!.getTime();
      return timeDifference || a.sourceIndex - b.sourceIndex;
    });

    for (let index = 1; index < vehicleRecords.length; index += 1) {
      const previous = vehicleRecords[index - 1]!;
      const current = vehicleRecords[index]!;
      if (!continuousIntervals.has(`${previous.sourceIndex}:${current.sourceIndex}`)) continue;
      const intervalMs = current.trackTime!.getTime() - previous.trackTime!.getTime();
      if (intervalMs <= 0 || intervalMs > MAX_LOCATION_INTERVAL_MS) continue;

      trackedDurationMs += intervalMs;
      if (previous.speedKph != null && previous.speedKph > 0) movingDurationMs += intervalMs;
      if (previous.ignitionOn === true) ignitionOnDurationMs += intervalMs;

      const distanceKm = haversineDistanceKm(previous, current);
      if (distanceKm != null && isPlausibleDistance(distanceKm, intervalMs)) {
        totalDistanceKm += distanceKm;
      }
    }
  }

  return {
    recordCount: records.length,
    uniqueVehicleCount: uniqueCount(records.map((record) => record.vehicleNo)),
    uniqueDriverCount: uniqueCount(records.map((record) => record.driverName)),
    uniqueLocationCount: uniqueCount(records.map((record) => record.location)),
    maxSpeedKph,
    averageSpeedKph: speedSampleCount > 0 ? speedTotal / speedSampleCount : 0,
    movingRecordCount,
    movingDurationMs,
    ignitionOnDurationMs,
    trackedDurationMs,
    totalDistanceKm,
  };
}
