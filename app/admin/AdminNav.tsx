'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAdminCopy } from './i18n-copy';
import type { DashboardLang } from 'app/dashboard/i18n-copy';

function NavPill({
  href,
  label,
  hint,
  isActive,
}: {
  href: string;
  label: string;
  hint: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      title={hint}
      aria-current={isActive ? 'page' : undefined}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
        isActive
          ? 'bg-red-50 text-red-800 ring-1 ring-red-200 dark:bg-red-950/80 dark:text-red-200 dark:ring-red-900'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminNav({ lang }: { lang: DashboardLang }) {
  const copy = getAdminCopy(lang);
  const pathname = usePathname();

  const LINKS: { href: string; label: string; hint: string; exact?: boolean }[] = [
    { href: '/admin', label: copy.overview, hint: copy.adminHome, exact: true },
    { href: '/admin/quick-setup', label: copy.quickSetup, hint: copy.quickSetupHint },
    { href: '/admin/companies', label: copy.companies, hint: copy.manageProfiles },
    { href: '/admin/organizations', label: copy.fleets, hint: copy.manageGroups },
    { href: '/admin/dashboards', label: copy.dashboardsNav, hint: copy.templatesAndLinks },
    { href: '/admin/line-channels', label: 'LINE channels', hint: 'LINE channels' },
    { href: '/admin/users', label: copy.users, hint: copy.accessAndRoles },
  ];

  return (
    <nav aria-label={copy.jumpToSection} className="flex flex-wrap items-center gap-1.5 text-sm">
      {LINKS.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : (pathname?.startsWith(link.href) ?? false);
        return <NavPill key={link.href} {...link} isActive={isActive} />;
      })}
    </nav>
  );
}
