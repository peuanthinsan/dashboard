import { notFound } from 'next/navigation';
import VinythaiSummaryDashboard, { VinythaiSummaryReport } from 'app/dashboards/VinythaiSummaryDashboard';
import { buildVinythaiAlerts } from 'app/dashboards/vinythaiSummaryData';
import { monthKeys, rows } from '../../../e2e/fixtures/vinythai-summary';

export const dynamic = 'force-dynamic';

export default async function VinythaiSummaryPreview({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_E2E_FIXTURES !== 'true') notFound();
  const { mode } = await searchParams;
  if (mode === 'fetch') return <VinythaiSummaryDashboard dashboardId="vinythai-test" dashboardName="Vinythai Monthly Summary — Test" sheetId="vinythai-test-sheet" sheetGid="0" lang="en" />;
  return <VinythaiSummaryReport alerts={buildVinythaiAlerts(rows)} monthKeys={monthKeys} dashboardName="Vinythai Monthly Summary — Preview" lang="th" dashboardNotes="Synthetic preview data for layout review." />;
}
