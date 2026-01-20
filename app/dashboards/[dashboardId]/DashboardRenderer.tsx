'use client';

import DetailDashboard from '../templates/DetailDashboard';
import SimpleDashboard from '../templates/SimpleDashboard';
import SummaryDashboard from '../templates/SummaryDashboard';
import type { DashboardTemplate } from '../types';

type DashboardRendererProps = {
  name: string;
  template: DashboardTemplate;
  sheetId: string;
  gid: string;
};

export default function DashboardRenderer({ name, template, sheetId, gid }: DashboardRendererProps) {
  switch (template) {
    case 'Summary':
      return <SummaryDashboard name={name} sheetId={sheetId} gid={gid} />;
    case 'Detail':
      return <DetailDashboard name={name} sheetId={sheetId} gid={gid} />;
    case 'Simple':
      return <SimpleDashboard name={name} sheetId={sheetId} gid={gid} />;
    default:
      return <SummaryDashboard name={name} sheetId={sheetId} gid={gid} />;
  }
}
