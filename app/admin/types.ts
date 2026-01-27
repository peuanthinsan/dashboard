export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export type Company = {
  id: number;
  name: string | null;
};

export type Organization = {
  id: number;
  name: string | null;
};

export type User = {
  id: number;
  email: string | null;
  isAdmin: boolean | null;
  companyIds?: number[];
  organizationIds?: number[];
};

export type Dashboard = {
  id: number;
  name: string | null;
  sheetUrl: string | null;
  template: string | null;
  companyId: number | null;
  organizationId: number | null;
  notes: string | null;
};
