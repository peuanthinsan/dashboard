export const dynamic = 'force-dynamic';

import { auth, signOut } from 'app/auth';
import { getDashboardsForUser, getUser } from 'app/db';
import AdminShortcut from './AdminShortcut';
import DashboardCard from './DashboardCard';
import LanguageToggle from './LanguageToggle';
import WelcomeBanner from './WelcomeBanner';
import { getDashboardCopy, getDashboardLang } from './i18n';
import EmptyState from 'app/ui/EmptyState';
import { pageContainer, pageContent, heading2, textSecondary, btnSecondary, btnSmall } from 'app/ui/design-tokens';

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
    <div className={pageContainer}>
      <div className={pageContent}>
        <div className="flex flex-col gap-6">
          <WelcomeBanner
            email={session?.user?.email ?? ''}
            dashboardCount={dashboards.length}
            lang={lang}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className={heading2}>{copy.yourDashboards}</h2>
              <p className={textSecondary}>{copy.dashboardsSubtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle lang={lang} />
              {isAdmin ? <AdminShortcut lang={lang} /> : null}
              <SignOut text={copy.signOut} />
            </div>
          </div>

          {dashboards.length === 0 ? (
            <EmptyState
              title={copy.noDashboards}
              description={copy.noDashboardsHelp}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dashboards.map((dashboard) => (
                <DashboardCard
                  key={dashboard.id}
                  id={dashboard.publicId}
                  name={dashboard.name ?? ''}
                  template={dashboard.template}
                  sheetUrl={dashboard.sheetUrl ?? ''}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
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
      <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
        {text}
      </button>
    </form>
  );
}
