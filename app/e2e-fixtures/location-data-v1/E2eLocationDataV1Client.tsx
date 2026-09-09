'use client';

import LocationDataV1Dashboard from 'app/dashboards/LocationDataV1Dashboard';

type LocationDataV1FixtureMode = 'fleet' | 'single-vehicle';

export default function E2eLocationDataV1Client({ mode = 'fleet' }: { mode?: LocationDataV1FixtureMode }) {
  const suffix = mode === 'single-vehicle' ? '-single-vehicle' : '';
  return (
    <LocationDataV1Dashboard
      dashboardId={`e2e-location-data-v1${suffix}`}
      dashboardName="Location Data v1"
      sheetId={`e2e-location-data-v1${suffix}-sheet`}
      sheetGid="0"
      dashboardNotes="Minute-by-minute route telemetry from the configured vehicle tracker."
      lang="en"
      isAdmin
    />
  );
}
