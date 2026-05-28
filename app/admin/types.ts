export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export type Company = {
  id: number;
  name: string | null;
  alertRules?: import('app/dashboards/dashboardDataUtils').AlertRule[] | null;
};

export type Organization = {
  id: number;
  name: string | null;
  companyId: number | null;
};

export type User = {
  id: number;
  email: string | null;
  isAdmin: boolean | null;
  showBothCompanyAndFleet?: boolean | null;
  companyIds?: number[];
  organizationIds?: number[];
};

export type Dashboard = {
  id: number;
  publicId?: string | null;
  name: string | null;
  sheetUrl: string | null;
  sheetId?: string | null;
  sheetGid?: string | null;
  template: string | null;
  notes: string | null;
  alertTypes?: string[] | null;
  remarks?: string[] | null;
  drivingThresholds?: {
    continuousDrivingMaxHours: number;
    restMinimumHours: number;
    workingHoursMax: number;
  } | null;
  alertRules?: import('app/dashboards/dashboardDataUtils').AlertRule[] | null;
  companyId: number | null;
  organizationId: number | null;
  lineChannelId?: number | null;
};
