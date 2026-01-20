import Link from 'next/link';
import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';

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
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-300">You are logged in as</p>
            <h1 className="text-3xl font-semibold">{session?.user?.email}</h1>
          </div>
          {isAdmin ? (
            <Link
              href="/admin"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              Go to administration
            </Link>
          ) : null}
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">Available dashboards</h2>
          {dashboards.length === 0 ? (
            <p className="text-sm text-slate-400">
              No dashboards are assigned to your companies yet. Ask an administrator to add one.
            </p>
          ) : (
            <div className="grid gap-3">
              {dashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={`/dashboard/${dashboard.publicId}`}
                  className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-600"
                >
                  <span className="text-base font-semibold text-white">{dashboard.name}</span>
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Template: {dashboard.template}
                  </span>
                  <span className="text-xs text-slate-500">{dashboard.sheetUrl}</span>
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
