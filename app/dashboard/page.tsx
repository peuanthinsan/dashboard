import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';

export default async function DashboardListPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await getUser(session.user.email);
  if (user.length === 0) {
    redirect('/protected');
  }

  const dashboards = await getDashboardsForUser({
    companyId: user[0].companyId ?? null,
    organizationId: user[0].organizationId ?? null,
  });

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Dashboards</h1>
          <p className="text-sm text-slate-500">
            Select a dashboard assigned to your company.
          </p>
        </header>

        {dashboards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No dashboards are assigned yet. Contact an administrator to add one for your
            company.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboards.map((dashboard) => (
              <Link
                key={dashboard.id}
                href={`/dashboard/${dashboard.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <h2 className="text-lg font-semibold text-slate-900">{dashboard.name}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Template: <span className="font-medium">{dashboard.template}</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">{dashboard.sheetUrl}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
