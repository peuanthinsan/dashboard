import Link from 'next/link';
import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';

export default async function ProtectedPage() {
  let session = await auth();
  let user = session?.user?.email ? await getUser(session.user.email) : [];
  let isAdmin = user.length > 0 && user[0].isAdmin;
  const dashboards =
    user.length > 0
      ? await getDashboardsForUser({
          companyId: user[0].companyId ?? null,
          organizationId: user[0].organizationId ?? null,
          isAdmin: user[0].isAdmin ?? false,
        })
      : [];

  return (
    <div className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Welcome</h1>
          <p className="text-sm text-slate-300">You are logged in as {session?.user?.email}</p>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Your dashboards</h2>
            <p className="text-sm text-slate-300">
              Dashboards assigned to your company {user[0]?.organizationId ? 'and organization' : ''} are listed below.
            </p>
          </div>
          {dashboards.length === 0 ? (
            <p className="text-sm text-slate-400">No dashboards are assigned to you yet.</p>
          ) : (
            <div className="grid gap-3">
              {dashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={`/dashboards/${dashboard.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-white transition hover:border-slate-600"
                >
                  <span className="font-semibold">{dashboard.name}</span>
                  <span className="text-xs text-slate-400">{dashboard.template} dashboard</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:border-white"
            >
              Go to administration
            </Link>
          ) : null}
          <SignOut />
        </div>
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
