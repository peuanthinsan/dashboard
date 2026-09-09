'use client';

import type { ComponentProps } from 'react';
import RawSimpleDashboard from './RawSimpleDashboard';
import SimpleMonthlyDashboard from './SimpleMonthlyDashboard';
import useSimpleSheet from './useSimpleSheet';
import DashboardShell from './DashboardShell';
import LoadingState from './LoadingState';

type DashboardProps = ComponentProps<typeof RawSimpleDashboard>;

function SimpleDashboardSource(props: DashboardProps) {
  const { result, error, refresh } = useSimpleSheet(props.sheetId, props.sheetGid);
  if (result?.kind === 'raw') return <RawSimpleDashboard {...props} />;
  if (result?.kind === 'summary') {
    return <SimpleMonthlyDashboard {...props} sheet={result} refresh={refresh} />;
  }
  return (
    <DashboardShell title={props.dashboardName}
      subtitle={props.lang === 'th' ? 'แดชบอร์ดแบบง่าย' : 'Simple dashboard'}
      lang={props.lang} dashboardId={props.dashboardId} isAdmin={props.isAdmin} notes={props.dashboardNotes}>
      <LoadingState lang={props.lang} error={error ?? undefined} onRetry={refresh} />
    </DashboardShell>
  );
}

export default function SimpleDashboard(props: DashboardProps) {
  return <SimpleDashboardSource key={`${props.dashboardId}:${props.sheetId}:${props.sheetGid}`} {...props} />;
}
