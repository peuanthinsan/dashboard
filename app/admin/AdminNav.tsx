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
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-2 text-sm text-slate-600 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300"
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
            className={`group relative inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-950 ${
              isActive
                ? 'border-slate-900 bg-slate-900 text-white shadow-md dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:hover:text-white'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full transition ${
                isActive
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-slate-300 group-hover:bg-slate-500 dark:bg-slate-600 dark:group-hover:bg-slate-400'
              }`}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
