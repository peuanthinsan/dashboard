'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/companies', label: 'Companies' },
  { href: '/admin/organizations', label: 'Fleets' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/dashboards', label: 'Dashboards' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        <span>Admin navigation</span>
        <span className="hidden text-[0.65rem] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500 sm:inline">
          Jump between sections
        </span>
      </div>
      <nav
        aria-label="Admin sections"
        className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 text-sm text-slate-600 dark:text-slate-300"
      >
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
              className={`relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-950 ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white shadow dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive
                    ? 'bg-emerald-300'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                aria-hidden="true"
              />
              <span>{link.label}</span>
              {isActive ? <span className="sr-only">(current)</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
