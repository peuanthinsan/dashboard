import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import { getServerLanguage } from 'app/i18n-server';
import AdminShortcut from './AdminShortcut';
import DashboardList from './DashboardList';
import { panelClass } from './styles';

const copy = {
  th: {
    loggedInAs: 'คุณกำลังเข้าสู่ระบบด้วย',
    description: 'ติดตามประสิทธิภาพ เจาะลึกแนวโน้ม และแชร์ข้อมูลล่าสุดให้ทีมของคุณ',
    signOut: 'ออกจากระบบ',
  },
  en: {
    loggedInAs: 'You are logged in as',
    description: 'Review performance, drill into trends, and share the latest insights with your team.',
    signOut: 'Sign out',
  },
} as const;

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user?.email ? await getUser(session.user.email) : [];
  const isAdmin = user.length > 0 && user[0].isAdmin;
  const language = getServerLanguage();
  const t = copy[language];
  const dashboards =
    user.length > 0
      ? await getDashboardsForUser({
          companyIds: user[0].companyIds ?? [],
          organizationIds: user[0].organizationIds ?? [],
        })
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-cyan-50 to-amber-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-6 ${panelClass}`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.loggedInAs}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{session?.user?.email}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
          </div>
          {isAdmin ? <AdminShortcut /> : null}
        </header>

        <section className={`grid gap-6 ${panelClass}`}>
          <DashboardList dashboards={dashboards} />
        </section>

        <SignOut label={t.signOut} />
      </div>
    </div>
  );
}

function SignOut({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-fuchsia-200 bg-white px-4 py-2 text-sm font-semibold text-fuchsia-700 shadow-sm transition hover:border-fuchsia-300 hover:text-fuchsia-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
      >
        {label}
      </button>
    </form>
  );
}
