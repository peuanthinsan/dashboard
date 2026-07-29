import Link from 'next/link';

import { signOut } from 'app/auth';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import LanguageToggle from 'app/dashboard/LanguageToggle';
import ThemeToggle from 'app/theme/ThemeToggle';
import SongdeeLogo from './SongdeeLogo';

type AppChromeProps = {
  active: 'dashboard' | 'admin';
  email?: string | null;
  lang: DashboardLang;
  showAdmin?: boolean;
};

async function logoutAction() {
  'use server';
  await signOut({ redirectTo: '/login' });
}

function DashboardIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A1.5 1.5 0 015.5 4h4A1.5 1.5 0 0111 5.5v4A1.5 1.5 0 019.5 11h-4A1.5 1.5 0 014 9.5v-4zm9 0A1.5 1.5 0 0114.5 4h4A1.5 1.5 0 0120 5.5v4a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 0113 9.5v-4zm-9 9A1.5 1.5 0 015.5 13h4a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 019.5 20h-4A1.5 1.5 0 014 18.5v-4zm9 0a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.75-2.7 8.3-7 10-4.3-1.7-7-5.25-7-10V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 11.5l1.6 1.6 3.6-3.6" />
    </svg>
  );
}

function NavLink({
  active,
  children,
  href,
  icon,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group relative inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
        active
          ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
          : 'text-zinc-600 hover:bg-white hover:text-zinc-950 hover:shadow-sm dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
      }`}
    >
      <span className={active ? 'text-red-400 dark:text-red-600' : 'text-zinc-400 transition-colors group-hover:text-red-500'}>
        {icon}
      </span>
      {children}
    </Link>
  );
}

export default function AppChrome({ active, email, lang, showAdmin = false }: AppChromeProps) {
  const copy =
    lang === 'th'
      ? {
          account: 'บัญชีผู้ใช้',
          admin: 'ผู้ดูแล',
          dashboard: 'แดชบอร์ด',
          navigation: 'เมนูหลัก',
          signOut: 'ออกจากระบบ',
          workspace: 'ศูนย์ควบคุมฟลีท',
        }
      : {
          account: 'Account',
          admin: 'Admin',
          dashboard: 'Dashboards',
          navigation: 'Primary navigation',
          signOut: 'Sign out',
          workspace: 'Fleet control centre',
        };

  const initial = email?.trim().charAt(0).toUpperCase() || 'S';

  return (
    <header
      className="sticky top-0 z-50 border-b border-zinc-200/70 bg-zinc-50/[0.85] pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/[0.82] dark:shadow-none"
      data-print-hide
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2.5 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="group flex min-w-0 shrink-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
        >
          <span className="flex h-9 items-center rounded-lg border border-zinc-200/70 bg-white px-2.5 shadow-sm transition-transform group-hover:-translate-y-px dark:border-zinc-700/70 dark:bg-zinc-900">
            <SongdeeLogo height={24} />
          </span>
          <span className="hidden min-w-0 xl:block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
              SongdeeGPS
            </span>
            <span className="block truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{copy.workspace}</span>
          </span>
        </Link>

        <div className="hidden h-7 w-px bg-zinc-200 dark:bg-zinc-800 lg:block" aria-hidden="true" />

        <nav
          aria-label={copy.navigation}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-zinc-100/80 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-zinc-900/80 sm:flex-none"
        >
          <NavLink href="/dashboard" active={active === 'dashboard'} icon={<DashboardIcon />}>
            {copy.dashboard}
          </NavLink>
          {showAdmin ? (
            <NavLink href="/admin" active={active === 'admin'} icon={<AdminIcon />}>
              {copy.admin}
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <LanguageToggle lang={lang} />
          <ThemeToggle />
          <div className="hidden h-7 w-px bg-zinc-200 dark:bg-zinc-800 sm:block" aria-hidden="true" />
          <details className="group relative block">
            <summary
              className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-zinc-200/70 bg-white px-2 pr-3 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/70 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 [&::-webkit-details-marker]:hidden"
              aria-label={copy.account}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-red-500 to-red-700 text-[11px] font-bold text-white shadow-sm">
                {initial}
              </span>
              <span className="hidden max-w-36 truncate lg:block">{email || copy.account}</span>
              <svg aria-hidden="true" className="h-3 w-3 text-zinc-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-2 shadow-2xl shadow-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30">
              <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{copy.account}</p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{email || 'SongdeeGPS'}</p>
              </div>
              <Link
                href="/dashboard/change-password"
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V8a5 5 0 0110 0v3m-9 0h8a2 2 0 012 2v6H6v-6a2 2 0 012-2z" />
                </svg>
                {lang === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change password'}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5m5 5H3m11-8h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
                  </svg>
                  {copy.signOut}
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" aria-hidden="true" />
    </header>
  );
}
