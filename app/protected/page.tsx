import Link from 'next/link';
import { auth, signOut } from 'app/auth';
import { getCompanies, getDashboardsForUser, getUser } from 'app/db';

export default async function ProtectedPage() {
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
  let companies = await getCompanies();
  let companyLookup = new Map(companies.map((company) => [company.id, company.name]));

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-slate-300">You are logged in as</p>
          <h1 className="text-3xl font-semibold">{session?.user?.email}</h1>
          {isAdmin ? (
            <Link
              href="/admin"
              className="w-fit rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:border-white"
            >
              Go to administration
            </Link>
          ) : null}
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">Available dashboards</h2>
          {dashboards.length === 0 ? (
            <p className="text-sm text-slate-400">
              No dashboards are assigned to your company yet. Ask an administrator to add one.
            </p>
          ) : (
            <div className="grid gap-3">
              {dashboards.map((dashboard) => {
                const companyName = companyLookup.get(dashboard.companyId);
                const isCompanyMatch = user[0]?.companyIds?.includes(dashboard.companyId ?? -1);
                return (
                  <Link
                    key={dashboard.id}
                    href={`/dashboard/${dashboard.id}`}
                    className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-600"
                  >
                    <span className="text-base font-semibold text-white">{dashboard.name}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      Template: {dashboard.template}
                    </span>
                    <span className="text-xs text-slate-400">
                      Company: {companyName ?? 'Unknown'}
                      {isCompanyMatch ? (
                        <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                          Assigned
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-slate-500">{dashboard.sheetUrl}</span>
                  </Link>
                );
              })}
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
