import Link from 'next/link';
import { getServerLanguage } from 'app/i18n-server';
import { badgeClass, cardClass, iconButtonClass, pillClass } from 'app/ui/classNames';
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
};

const copy = {
  th: {
    title: 'แดชบอร์ดของคุณ',
    subtitle: 'กลับมาดูแดชบอร์ดที่ใช้บ่อยและสำรวจข้อมูลเชิงลึกล่าสุดได้ทันที',
    total: 'ทั้งหมด',
    templates: 'เทมเพลต',
    emptyTitle: 'ยังไม่มีแดชบอร์ดที่ถูกมอบหมาย',
    emptyText: 'โปรดติดต่อผู้ดูแลระบบเพื่อเพิ่มแดชบอร์ดให้บริษัทหรือกลุ่มรถของคุณ',
    openDashboard: 'เปิดแดชบอร์ด',
    liveData: 'เชื่อมต่อข้อมูลสดแล้ว',
    dataSource: 'แหล่งข้อมูล',
  },
  en: {
    title: 'Your dashboards',
    subtitle: 'Jump right back into the dashboards you use most and explore the latest insights.',
    total: 'Total',
    templates: 'Templates',
    emptyTitle: 'No dashboards assigned yet.',
    emptyText: 'Ask an administrator to add a dashboard for your companies or fleets.',
    openDashboard: 'Open',
    liveData: 'Live data connected',
    dataSource: 'Data source',
  },
} as const;

export default function DashboardList({ dashboards }: DashboardListProps) {
  const dashboardCount = dashboards.length;
  const templateCount = new Set(dashboards.map((dashboard) => dashboard.template)).size;
  const hasDashboards = dashboardCount > 0;
  const t = copy[getServerLanguage()];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={pillClass}>{dashboardCount} {t.total}</span>
          <span className={pillClass}>{templateCount} {t.templates}</span>
        </div>
      </div>

      {!hasDashboards ? (
        <div className={emptyStateClass}>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.emptyTitle}</p>
          <p className="mt-2">{t.emptyText}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`/dashboard/${dashboard.publicId ?? ''}`}
              className={cardClass}
              aria-label={`${t.openDashboard} ${dashboard.name}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{dashboard.name}</span>
                    <div className={badgeClass}>
                      <span className="h-2 w-2 rounded-full bg-fuchsia-400 dark:bg-fuchsia-300" />
                      {dashboard.template}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400/80" />
                    {t.liveData}
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
                  {t.dataSource}
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
