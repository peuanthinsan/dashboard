import { getDashboardLang, type DashboardLang } from './i18n';
import { auth } from 'app/auth';
import { getUser } from 'app/db';
import AppChrome from 'app/ui/AppChrome';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let lang: DashboardLang;
  try {
    lang = await getDashboardLang();
  } catch (err) {
    console.error('[Dashboard layout error]', err);
    throw err;
  }

  const session = await auth();
  const user = session?.user?.email ? await getUser(session.user.email) : [];
  const isAdmin = Boolean(user[0]?.isAdmin);

  return (
    <div className="app-shell min-h-[100dvh] min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppChrome active="dashboard" email={session?.user?.email} lang={lang} showAdmin={isAdmin} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  );
}
