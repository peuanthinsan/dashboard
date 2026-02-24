import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import AdminShortcut from './AdminShortcut';
import DashboardList from './DashboardList';
import LanguageToggle from './LanguageToggle';
import { getDashboardCopy, getDashboardLang } from './i18n';
import { panelClass } from './styles';

export default async function DashboardPage() {
  const lang = getDashboardLang();
  const copy = getDashboardCopy(lang);
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-fuchsia-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-6 ${panelClass}`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{copy.loggedInAs}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{session?.user?.email}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {copy.dashboardIntro}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle lang={lang} />
            {isAdmin ? <AdminShortcut lang={lang} /> : null}
          </div>
        </header>

        <section className={`grid gap-6 ${panelClass}`}>
          <DashboardList dashboards={dashboards} lang={lang} />
        </section>

        <SignOut text={copy.signOut} />
      </div>
    </div>
  );
}

function SignOut({ text }: { text: string }) {
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
        {text}
      </button>
    </form>
  );
}
