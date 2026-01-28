import Link from 'next/link';
import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import AdminShortcut from './AdminShortcut';

export default async function DashboardPage() {
  let session = await auth();
  let user = session?.user?.email ? await getUser(session.user.email) : [];
  let isAdmin = user.length > 0 && user[0].isAdmin;
  let dashboards =
    user.length > 0
      ? await getDashboardsForUser({
          companyIds: user[0].companyIds ?? [],
          organizationIds: user[0].organizationIds ?? [],
        })
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/70 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Dashboard hub
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{session?.user?.email}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pick a dashboard to review performance, drill into trends, and export the latest insights for your
              team.
            </p>
          </div>
          {isAdmin ? <AdminShortcut /> : null}
        </header>

        <section className="grid gap-6 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-xl backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Available dashboards</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tailored views based on your companies and organizations.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              {dashboards.length} Total
            </span>
          </div>
          {dashboards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              No dashboards are assigned to your companies yet. Ask an administrator to add one.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={`/dashboard/${dashboard.publicId}`}
                  className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-semibold text-slate-900 dark:text-white">
                        {dashboard.name}
                      </span>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm dark:bg-slate-800/80 dark:text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" />
                        {dashboard.template}
                      </div>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:border-slate-500 dark:group-hover:bg-slate-900 dark:group-hover:text-white">
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
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      Data source
                    </span>
                    <span className="mt-1 block truncate font-mono text-[11px]">{dashboard.sheetUrl}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <SignOut />
      </div>
    </div>
  );
}

function SignOut() {
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
        Sign out
      </button>
    </form>
  );
}
