import Link from 'next/link';
import { badgeClass, cardClass, iconButtonClass, pillClass } from 'app/ui/classNames';
import { t, type DashboardLang, withDashboardLang } from './i18n';
import { dataSourceClass, emptyStateClass } from './styles';

type Dashboard = {
  id: number;
  publicId: string | null;
  name: string;
  template: string;
  sheetUrl: string;
};

type DashboardListProps = {
  dashboards: Dashboard[];
  lang: DashboardLang;
};

export default function DashboardList({ dashboards, lang }: DashboardListProps) {
  const dashboardCount = dashboards.length;
  const templateCount = new Set(dashboards.map((dashboard) => dashboard.template)).size;
  const hasDashboards = dashboardCount > 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t(lang, 'Your dashboards', 'แดชบอร์ดของคุณ')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(
              lang,
              'Jump right back into the dashboards you use most and explore the latest insights.',
              'กลับเข้าสู่แดชบอร์ดที่คุณใช้บ่อย และสำรวจข้อมูลเชิงลึกล่าสุดได้ทันที',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={pillClass}>{dashboardCount} {t(lang, 'Total', 'ทั้งหมด')}</span>
          <span className={pillClass}>{templateCount} {t(lang, 'Templates', 'เทมเพลต')}</span>
        </div>
      </div>

      {!hasDashboards ? (
        <div className={emptyStateClass}>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{t(lang, 'No dashboards assigned yet.', 'ยังไม่มีแดชบอร์ดที่ได้รับมอบหมาย')}</p>
          <p className="mt-2">
            {t(lang, 'Ask an administrator to add a dashboard for your companies or fleets.', 'กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มแดชบอร์ดสำหรับบริษัทหรือกองรถของคุณ')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={withDashboardLang(`/dashboard/${dashboard.publicId ?? ''}`, lang)}
              className={cardClass}
              aria-label={t(lang, `Open ${dashboard.name} dashboard`, `เปิดแดชบอร์ด ${dashboard.name}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{dashboard.name}</span>
                    <div className={badgeClass}>
                      <span className="h-2 w-2 rounded-full bg-fuchsia-500 dark:bg-fuchsia-300" />
                      {dashboard.template}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex h-2 w-2 rounded-full bg-cyan-500/80" />
                    {t(lang, 'Live data connected', 'เชื่อมต่อข้อมูลสดแล้ว')}
                  </div>
                </div>
                <span className={iconButtonClass}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </div>
              <div className={dataSourceClass}>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {t(lang, 'Data source', 'แหล่งข้อมูล')}
                </span>
                <span className="mt-1 block truncate font-mono text-[11px]">{dashboard.sheetUrl}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
