'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin', label: 'Overview', hint: 'Admin home' },
  { href: '/admin/companies', label: 'Companies', hint: 'Manage profiles' },
  { href: '/admin/organizations', label: 'Fleets', hint: 'Manage groups' },
  { href: '/admin/users', label: 'Users', hint: 'Access & roles' },
  { href: '/admin/dashboards', label: 'Dashboards', hint: 'Templates & links' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
        Jump to section
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
              className={`group flex min-w-[150px] flex-1 flex-col gap-1 rounded-2xl border px-3 py-2 text-left font-medium shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                isActive
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 shadow dark:border-emerald-300 dark:bg-emerald-300/15 dark:text-emerald-50'
                  : 'border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive
                        ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)] dark:bg-emerald-300 dark:shadow-[0_0_0_4px_rgba(110,231,183,0.25)]'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                  <span>{link.label}</span>
                </span>
                {isActive ? (
                  <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-200/20 dark:text-emerald-100">
                    Current
                  </span>
                ) : null}
              </span>
              <span className="text-xs font-normal text-slate-500 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-200">
                {link.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
