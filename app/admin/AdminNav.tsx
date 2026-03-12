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
      className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-300"
    >
      <span className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
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
              className={`group flex min-w-[140px] flex-1 flex-col gap-1 rounded-lg border px-3 py-2.5 text-left font-medium transition ${
                isActive
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive
                        ? 'bg-indigo-500 dark:bg-indigo-400'
                        : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  />
                  <span>{link.label}</span>
                </span>
                {isActive ? (
                  <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
                    Active
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
