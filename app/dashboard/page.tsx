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
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-black dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">You are logged in as</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{session?.user?.email}</h1>
          </div>
          {isAdmin ? <AdminShortcut /> : null}
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900/60 sm:p-6">
          <h2 className="text-lg font-medium">Available dashboards</h2>
          {dashboards.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No dashboards are assigned to your companies yet. Ask an administrator to add one.
            </p>
          ) : (
            <div className="grid gap-3">
              {dashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={`/dashboard/${dashboard.publicId}`}
                  className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-600"
                >
                  <span className="text-base font-semibold text-slate-900 dark:text-white">{dashboard.name}</span>
                  <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Template: {dashboard.template}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">{dashboard.sheetUrl}</span>
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
      <button type="submit">Sign out</button>
    </form>
  );
}
