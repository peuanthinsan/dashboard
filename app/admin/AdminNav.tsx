'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAdminCopy } from './i18n-copy';
import type { DashboardLang } from 'app/dashboard/i18n-copy';

export default function AdminNav({ lang }: { lang: DashboardLang }) {
  const copy = getAdminCopy(lang);
  const NAV_LINKS = [
    { href: '/admin', label: copy.overview, hint: copy.adminHome },
    { href: '/admin/companies', label: copy.companies, hint: copy.manageProfiles },
    { href: '/admin/organizations', label: copy.fleets, hint: copy.manageGroups },
    { href: '/admin/users', label: copy.users, hint: copy.accessAndRoles },
    { href: '/admin/dashboards', label: copy.dashboardsNav, hint: copy.templatesAndLinks },
  ];
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-300"
    >
      <span className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {copy.jumpToSection}
      </span>
      <div className="flex flex-wrap gap-2">
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === '/admin'
              ? pathname === link.href
              : pathname?.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex min-w-[140px] flex-1 flex-col gap-1 rounded-lg border px-3 py-2.5 text-left font-medium transition ${
                isActive
                  ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-200'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive
                        ? 'bg-red-500 dark:bg-red-400'
                        : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  />
                  <span>{link.label}</span>
                </span>
                {isActive ? (
                  <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900 dark:text-red-300">
                    {copy.active}
                  </span>
                ) : null}
              </span>
              <span className="text-xs font-normal text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-300">
                {link.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
