import { cookies } from 'next/headers';
import { DASHBOARD_LANG_COOKIE, type DashboardLang, dashboardCopy, getDashboardCopy } from './i18n-copy';

export type { DashboardLang };
export { DASHBOARD_LANG_COOKIE, dashboardCopy, getDashboardCopy };

export const getDashboardLang = (): DashboardLang => {
  const value = cookies().get(DASHBOARD_LANG_COOKIE)?.value;
  return value === 'th' ? 'th' : 'en';
};
