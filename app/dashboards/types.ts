export const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple'] as const;

export type DashboardTemplate = (typeof DASHBOARD_TEMPLATES)[number];

export type DashboardRecord = {
  id: number;
  name: string;
  template: DashboardTemplate;
  sheetUrl: string;
  sheetId: string;
  gid: string;
  companyId: number;
  organizationId: number | null;
};
