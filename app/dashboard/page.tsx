import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import DashboardHomeClient from './DashboardHomeClient';

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user?.email ? await getUser(session.user.email) : [];
  const isAdmin = user.length > 0 && Boolean(user[0].isAdmin);
  const dashboards =
    user.length > 0
      ? await getDashboardsForUser({
          companyIds: user[0].companyIds ?? [],
          organizationIds: user[0].organizationIds ?? [],
        })
      : [];
  return (
    <>
      <DashboardHomeClient email={session?.user?.email} isAdmin={isAdmin} dashboards={dashboards} />
      <div className="fixed bottom-4 right-4">
        <SignOut />
      </div>
    </>
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
        ออกจากระบบ
      </button>
    </form>
  );
}
