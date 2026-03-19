import Link from 'next/link';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import ThemeToggle from 'app/theme/ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { getDashboardLang } from './i18n';
import { surface } from 'app/ui/design-tokens';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const lang = await getDashboardLang();

    return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header
        className={`sticky top-0 z-40 border-b border-zinc-200/60 ${surface} backdrop-blur-sm dark:border-zinc-800/60`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
            >
              <SongdeeLogo height={28} />
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {lang === 'th' ? 'แดชบอร์ด' : 'Dashboards'}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle lang={lang} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
    );
  } catch (err) {
    console.error('[Dashboard layout error]', err);
    throw err;
  }
}
