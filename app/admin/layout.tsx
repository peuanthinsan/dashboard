import { getDashboardLang } from 'app/dashboard/i18n';
import { auth } from 'app/auth';
import AppChrome from 'app/ui/AppChrome';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getDashboardLang();
  const session = await auth();

  return (
    <div className="app-shell min-h-[100dvh] min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppChrome active="admin" email={session?.user?.email} lang={lang} showAdmin />
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  );
}
