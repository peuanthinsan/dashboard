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
    <div className="min-h-screen bg-[var(--app-bg)] px-4 py-8 text-[var(--app-text)] sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--app-text-muted)]">You are logged in as</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{session?.user?.email}</h1>
          </div>
          {isAdmin ? (
            <Link
              href="/admin"
              className="inline-flex w-fit items-center rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm text-[var(--app-text)] transition hover:border-[var(--app-border-strong)]"
            >
              Go to administration
            </Link>
          ) : null}
        </header>

        <section className="grid gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 shadow-lg sm:p-6">
          <h2 className="text-lg font-medium">Available dashboards</h2>
          {dashboards.length === 0 ? (
            <p className="text-sm text-[var(--app-text-subtle)]">
              No dashboards are assigned to your companies yet. Ask an administrator to add one.
            </p>
          ) : (
            <div className="grid gap-3">
              {dashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={`/dashboard/${dashboard.publicId}`}
                  className="flex flex-col gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 transition hover:border-[var(--app-border-strong)]"
                >
                  <span className="text-base font-semibold text-[var(--app-text)]">
                    {dashboard.name}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-[var(--app-text-subtle)]">
                    Template: {dashboard.template}
                  </span>
                  <span className="text-xs text-[var(--app-text-faint)]">{dashboard.sheetUrl}</span>
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
