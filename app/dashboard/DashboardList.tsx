import Link from 'next/link';
import { badgeClass, cardClass, iconButtonClass, pillClass } from 'app/ui/classNames';
import { dataSourceClass, emptyStateClass } from './styles';
import { tr, useDashboardLanguage } from 'app/dashboards/i18n';

type Dashboard = {
  id: number;
  publicId: string | null;
  name: string;
  template: string;
  sheetUrl: string;
};

type DashboardListProps = {
  dashboards: Dashboard[];
};

export default function DashboardList({ dashboards }: DashboardListProps) {
  const { language } = useDashboardLanguage();
  const dashboardCount = dashboards.length;
  const templateCount = new Set(dashboards.map((dashboard) => dashboard.template)).size;
  const hasDashboards = dashboardCount > 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{tr(language, 'Your dashboards', 'แดชบอร์ดของคุณ')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {tr(language, 'Jump right back into the dashboards you use most and explore the latest insights.', 'กลับเข้าสู่แดชบอร์ดที่คุณใช้บ่อย และสำรวจข้อมูลเชิงลึกล่าสุด')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={pillClass}>{dashboardCount} {tr(language, 'Total', 'ทั้งหมด')}</span>
          <span className={pillClass}>{templateCount} {tr(language, 'Templates', 'เทมเพลต')}</span>
        </div>
      </div>

      {!hasDashboards ? (
        <div className={emptyStateClass}>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{tr(language, 'No dashboards assigned yet.', 'ยังไม่มีการกำหนดแดชบอร์ด')}</p>
          <p className="mt-2">
            {tr(language, 'Ask an administrator to add a dashboard for your companies or fleets.', 'โปรดติดต่อผู้ดูแลระบบเพื่อเพิ่มแดชบอร์ดสำหรับบริษัทหรือกองรถของคุณ')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`/dashboard/${dashboard.publicId ?? ''}`}
              className={cardClass}
              aria-label={tr(language, `Open ${dashboard.name} dashboard`, `เปิดแดชบอร์ด ${dashboard.name}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{dashboard.name}</span>
                    <div className={badgeClass}>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" />
                      {dashboard.template}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/70" />
                    {tr(language, 'Live data connected', 'เชื่อมต่อข้อมูลสดแล้ว')}
                  </div>
                </div>
                <span className={iconButtonClass}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </div>
              <div className={dataSourceClass}>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {tr(language, 'Data source', 'แหล่งข้อมูล')}
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
