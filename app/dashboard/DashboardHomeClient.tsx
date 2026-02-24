'use client';

import AdminShortcut from './AdminShortcut';
import DashboardList from './DashboardList';
import { panelClass } from './styles';
import { DashboardLanguageProvider, tr, useDashboardLanguage } from 'app/dashboards/i18n';

type Dashboard = {
  id: number;
  publicId: string | null;
  name: string;
  template: string;
  sheetUrl: string;
};

export default function DashboardHomeClient({
  email,
  isAdmin,
  dashboards,
}: {
  email?: string | null;
  isAdmin: boolean;
  dashboards: Dashboard[];
}) {
  return (
    <DashboardLanguageProvider>
      <DashboardHomeContent email={email} isAdmin={isAdmin} dashboards={dashboards} />
    </DashboardLanguageProvider>
  );
}

function DashboardHomeContent({
  email,
  isAdmin,
  dashboards,
}: {
  email?: string | null;
  isAdmin: boolean;
  dashboards: Dashboard[];
}) {
  const { language, setLanguage } = useDashboardLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-cyan-50 to-amber-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-6 ${panelClass}`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{tr(language, 'You are logged in as', 'คุณเข้าสู่ระบบในชื่อ')}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{email}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {tr(
                language,
                'Review performance, drill into trends, and share the latest insights with your team.',
                'ตรวจสอบผลการดำเนินงาน เจาะลึกแนวโน้ม และแชร์ข้อมูลล่าสุดให้ทีมของคุณ',
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/10 dark:text-fuchsia-200"
              onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
            >
              {language === 'th' ? 'EN' : 'TH'}
            </button>
            {isAdmin ? <AdminShortcut /> : null}
          </div>
        </header>

        <section className={`grid gap-6 ${panelClass}`}>
          <DashboardList dashboards={dashboards} />
        </section>
      </div>
    </div>
  );
}
