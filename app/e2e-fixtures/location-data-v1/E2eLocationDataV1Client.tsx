'use client';

import { useEffect, useState } from 'react';
import LocationDataV1Dashboard from 'app/dashboards/LocationDataV1Dashboard';

const DASHBOARD_ID = 'e2e-location-data-v1';
const SHEET_ID = 'e2e-location-data-v1-sheet';
const SHEET_GID = '0';

const HEADERS = [
  'Vehicle No',
  'Track Time',
  'Latitude',
  'Longitude',
  'GPS Status',
  'Location',
  'Speed',
  'Ignition',
  'Driver Name',
  'Face ID',
  'Polling Mode',
  'Fuelbar',
  'Updated Time',
] as const;

const LOCATIONS = [
  'ถนนสุขุมวิท ตำบลบางปูใหม่ อำเภอเมืองสมุทรปราการ',
  'ถนนเทพารักษ์ ตำบลแพร่ใหม่ จังหวัดสมุทรปราการ',
  'ถนนบางนา-ตราด แขวงบางนา กรุงเทพมหานคร',
  'ถนนอ่อนนุช-ลาดกระบัง เขตประเวศ กรุงเทพมหานคร',
  'คลังสินค้าบางพลี อำเภอบางพลี จังหวัดสมุทรปราการ',
  'ศูนย์กระจายสินค้า ตำบลบางเสาธง จังหวัดสมุทรปราการ',
];

function sourceDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

const sampleRows = Array.from({ length: 596 }, (_, sourceIndex) => {
  const chronologicalIndex = 595 - sourceIndex;
  const time = new Date(Date.UTC(2026, 8, 1, 8, 14 + chronologicalIndex));
  const progress = chronologicalIndex / 595;
  const routeProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
  const ignitionOn = chronologicalIndex > 28 && chronologicalIndex < 480;
  const speedWave = Math.sin(chronologicalIndex / 13) * 24 + Math.sin(chronologicalIndex / 4.5) * 12 + 32;
  const stoppedWindow = chronologicalIndex % 97 < 18 || !ignitionOn;
  const speed = stoppedWindow ? 0 : Math.max(4, Math.min(73, Math.round(speedWave)));
  const latitude = 13.53018 + routeProgress * 0.122 + Math.sin(chronologicalIndex / 31) * 0.008;
  const longitude = 100.65267 + Math.sin(routeProgress * Math.PI) * 0.056 + Math.sin(chronologicalIndex / 47) * 0.005;
  const pollingMode = chronologicalIndex === 31
    ? 'ACC ON'
    : chronologicalIndex === 479
      ? 'ACC OFF'
      : chronologicalIndex % 173 === 0
        ? 'Trip notification'
        : 'Normal';
  return {
    'Vehicle No': 'LOC-0055',
    'Track Time': sourceDate(time),
    Latitude: Number(latitude.toFixed(7)),
    Longitude: Number(longitude.toFixed(7)),
    'GPS Status': 'A',
    Location: LOCATIONS[Math.min(LOCATIONS.length - 1, Math.floor(routeProgress * LOCATIONS.length))],
    Speed: speed,
    Ignition: ignitionOn ? 'ON' : 'OFF',
    'Driver Name': chronologicalIndex < 3 ? '' : 'Driver A',
    'Face ID': '',
    'Polling Mode': pollingMode,
    Fuelbar: 0,
    'Updated Time': sourceDate(new Date(time.getTime() + 60 * 60 * 1_000)),
  };
});

const columns = HEADERS.map((label) => ({ label, fieldKey: label, type: label.includes('Time') ? 'datetime' : 'string' }));

export default function E2eLocationDataV1Client() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const now = Date.now();
    localStorage.setItem(
      `google-sheet:v9:${SHEET_ID}:${SHEET_GID}:video=false:months=recent`,
      JSON.stringify({ columns, rows: sampleRows, lastUpdated: now }),
    );
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!ready) return null;

  return (
    <LocationDataV1Dashboard
      dashboardId={DASHBOARD_ID}
      dashboardName="Location Data v1"
      sheetId={SHEET_ID}
      sheetGid={SHEET_GID}
      dashboardNotes="Minute-by-minute route telemetry from the configured vehicle tracker."
      lang="en"
      isAdmin
    />
  );
}
