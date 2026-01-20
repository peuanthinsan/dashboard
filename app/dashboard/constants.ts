export const dashboardTemplates = ['Summary', 'Detail', 'Simple'] as const;

export type DashboardTemplate = (typeof dashboardTemplates)[number];
