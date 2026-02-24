import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import AdminShortcut from './AdminShortcut';
import DashboardList from './DashboardList';
import { resolveDashboardLang, t, withDashboardLang } from './i18n';
import { panelClass } from './styles';

export default async function DashboardPage({ searchParams }: { searchParams?: { lang?: string } }) {
  const lang = resolveDashboardLang(searchParams?.lang);
  const session = await auth();
  const user = session?.user?.email ? await getUser(session.user.email) : [];
  const isAdmin = user.length > 0 && user[0].isAdmin;
  const dashboards =
    user.length > 0
      ? await getDashboardsForUser({
          companyIds: user[0].companyIds ?? [],
          organizationIds: user[0].organizationIds ?? [],
        })
      : [];
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-cyan-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-6 ${panelClass}`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t(lang, 'You are logged in as', 'คุณเข้าสู่ระบบในชื่อ')}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{session?.user?.email}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(
                lang,
                'Review performance, drill into trends, and share the latest insights with your team.',
                'ตรวจสอบผลการดำเนินงาน เจาะลึกแนวโน้ม และแชร์ข้อมูลเชิงลึกล่าสุดกับทีมของคุณ',
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-fuchsia-300/80 bg-fuchsia-100/70 p-1 text-xs dark:border-fuchsia-800 dark:bg-fuchsia-950/40">
              <a href={withDashboardLang('/dashboard', 'th')} className={`rounded-full px-3 py-1 ${lang === 'th' ? 'bg-fuchsia-500 text-white' : 'text-fuchsia-700 dark:text-fuchsia-200'}`}>
                ไทย
              </a>
              <a href={withDashboardLang('/dashboard', 'en')} className={`rounded-full px-3 py-1 ${lang === 'en' ? 'bg-fuchsia-500 text-white' : 'text-fuchsia-700 dark:text-fuchsia-200'}`}>
                EN
              </a>
            </div>
            {isAdmin ? <AdminShortcut /> : null}
          </div>
        </header>

        <section className={`grid gap-6 ${panelClass}`}>
          <DashboardList dashboards={dashboards} lang={lang} />
        </section>

        <SignOut lang={lang} />
      </div>
    </div>
  );
}

function SignOut({ lang }: { lang: 'en' | 'th' }) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
      >
        {t(lang, 'Sign out', 'ออกจากระบบ')}
      </button>
    </form>
  );
}
