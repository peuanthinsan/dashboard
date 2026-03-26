import Link from 'next/link';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import ThemeToggle from 'app/theme/ThemeToggle';
import LanguageToggle from 'app/dashboard/LanguageToggle';
import { getDashboardLang } from 'app/dashboard/i18n';
import { surface } from 'app/ui/design-tokens';
import { getAdminCopy } from './i18n-copy';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);

  const navLabel = lang === 'th' ? 'เมนูหลัก' : 'Primary navigation';
  const navLinkClass =
    'shrink-0 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

  return (
    <div className="min-h-[100dvh] min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header
        className={`sticky top-0 z-40 border-b border-zinc-200/60 ${surface} backdrop-blur-sm dark:border-zinc-800/60 pt-[env(safe-area-inset-top)]`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
              <Link
                href="/dashboard"
                className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
              >
                <SongdeeLogo height={28} />
              </Link>
              <nav className="hidden min-w-0 items-center gap-1 sm:flex" aria-label={navLabel}>
                <Link href="/dashboard" className={navLinkClass}>
                  {copy.dashboards}
                </Link>
                <Link href="/admin" className={navLinkClass}>
                  {copy.admin}
                </Link>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <LanguageToggle lang={lang} />
              <ThemeToggle />
            </div>
          </div>
          <nav
            className="flex border-t border-zinc-200/60 dark:border-zinc-800/60 sm:hidden"
            aria-label={navLabel}
          >
            <div className="flex w-full gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href="/dashboard" className={navLinkClass}>
                {copy.dashboards}
              </Link>
              <Link href="/admin" className={navLinkClass}>
                {copy.admin}
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  );
}
