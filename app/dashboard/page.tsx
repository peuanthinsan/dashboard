export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import AdminShortcut from './AdminShortcut';
import WelcomeBanner from './WelcomeBanner';
import { getDashboardCopy, getDashboardLang } from './i18n';
import EmptyState from 'app/ui/EmptyState';
import { pageContainer, pageContent, heading2, textSecondary, btnSecondary, btnSmall } from 'app/ui/design-tokens';
import { DashboardByCompany } from './DashboardByCompany';

export default async function DashboardPage() {
  try {
    const lang = await getDashboardLang();
    const copy = getDashboardCopy(lang);
    const session = await auth();
    const user = session?.user?.email ? await getUser(session.user.email) : [];
    const isAdmin = user.length > 0 && user[0].isAdmin;
    const showBoth = user[0]?.showBothCompanyAndFleet ?? false;
    const dashboards =
      user.length > 0
        ? await getDashboardsForUser({
            companyIds: user[0].companyIds ?? [],
            organizationIds: user[0].organizationIds ?? [],
            showBoth,
          })
        : [];

    return (
    <div className={pageContainer}>
      <div className={pageContent}>
        <div className="flex flex-col gap-5">
          <WelcomeBanner
            email={session?.user?.email ?? ''}
            dashboardCount={dashboards.length}
            lang={lang}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className={heading2}>{copy.yourDashboards}</h2>
              <p className={textSecondary}>{copy.dashboardsSubtitle}</p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {isAdmin ? <AdminShortcut lang={lang} /> : null}
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:flex-wrap">
                <Link
                  href="/dashboard/change-password"
                  className={`${btnSecondary} ${btnSmall} flex w-full items-center justify-center gap-1.5 sm:inline-flex sm:w-auto`}
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {lang === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Password'}
                </Link>
                <SignOut text={copy.signOut} />
              </div>
            </div>
          </div>

          {dashboards.length === 0 ? (
            <EmptyState
              variant="dashboard"
              title={copy.noDashboards}
              description={copy.noDashboardsHelp}
            />
          ) : (
            <DashboardByCompany dashboards={dashboards} lang={lang} copy={copy} />
          )}
        </div>
      </div>
    </div>
    );
  } catch (err) {
    console.error('[Dashboard page error]', err);
    throw err;
  }
}

function SignOut({ text }: { text: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      <button type="submit" className={`${btnSecondary} ${btnSmall} w-full sm:w-auto`}>
        {text}
      </button>
    </form>
  );
}
