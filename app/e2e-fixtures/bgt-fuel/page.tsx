import { notFound } from 'next/navigation';
import FuelTopUpDashboard from 'app/dashboards/FuelTopUpDashboard';

export const dynamic = 'force-dynamic';

/** Local review only. Telemetry is fetched from the supplied public sheet, never bundled. */
export default function BgtFuelPreview() {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_E2E_FIXTURES !== 'true') notFound();
  return <FuelTopUpDashboard dashboardId="bgt-fuel-preview" dashboardName="BGT fuel dashboard"
    sheetId="1N75-uh50HSPkaEv4JXItrwRLsCHOkG0qxd9GHkl3XjA" sheetGid="0" lang="en" />;
}
