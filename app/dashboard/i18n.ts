export type DashboardLang = 'en' | 'th';

export const resolveDashboardLang = (value?: string): DashboardLang => (value === 'en' ? 'en' : 'th');

export const withDashboardLang = (href: string, lang: DashboardLang) => {
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}lang=${lang}`;
};

export const t = (lang: DashboardLang, en: string, th: string) => (lang === 'th' ? th : en);
