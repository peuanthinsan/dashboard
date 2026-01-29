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
    <nav className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
      {NAV_LINKS.map((link) => {
        const isActive =
          link.href === '/admin'
            ? pathname === link.href
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 font-medium shadow-sm transition ${
              isActive
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
