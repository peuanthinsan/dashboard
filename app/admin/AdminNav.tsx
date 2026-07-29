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
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  isActive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={hint}
      aria-current={isActive ? 'page' : undefined}
      className={`group inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-all ${
        isActive
          ? 'bg-zinc-950 text-white shadow-sm ring-1 ring-zinc-950 dark:bg-white dark:text-zinc-950 dark:ring-white'
          : 'text-zinc-600 hover:bg-white hover:text-zinc-950 hover:shadow-sm dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
      }`}
    >
      <span className={isActive ? 'text-red-400 dark:text-red-600' : 'text-zinc-400 transition-colors group-hover:text-red-500'}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function NavIcon({ type }: { type: 'overview' | 'quick' | 'company' | 'fleet' | 'dashboard' | 'line' | 'user' }) {
  const paths = {
    overview: 'M4 13h6V4H4v9zm10 7h6v-9h-6v9zM4 20h6v-3H4v3zm10-13h6V4h-6v3z',
    quick: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
    company: 'M3 21h18M5 21V8l7-4 7 4v13M9 12h1m4 0h1m-6 4h1m4 0h1',
    fleet: 'M4 17h16M6 17l1-7h10l1 7M8 10l1-4h6l1 4M7 20h.01M17 20h.01',
    dashboard: 'M4 5.5A1.5 1.5 0 015.5 4h4A1.5 1.5 0 0111 5.5v4A1.5 1.5 0 019.5 11h-4A1.5 1.5 0 014 9.5v-4zm9 0A1.5 1.5 0 0114.5 4h4A1.5 1.5 0 0120 5.5v4a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 0113 9.5v-4zm-9 9A1.5 1.5 0 015.5 13h4a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 019.5 20h-4A1.5 1.5 0 014 18.5v-4zm9 0a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4z',
    line: 'M20 11.5c0 4.1-3.6 7.5-8 7.5a8.8 8.8 0 01-2.2-.3L5 21l1.2-3.7A7.1 7.1 0 014 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z',
    user: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8-1v6m3-3h-6',
  } as const;

  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[type]} />
    </svg>
  );
}

export default function AdminNav({ lang }: { lang: DashboardLang }) {
  const copy = getAdminCopy(lang);
  const pathname = usePathname();

  const groups: {
    label: string;
    links: { href: string; label: string; hint: string; exact?: boolean; icon: Parameters<typeof NavIcon>[0]['type'] }[];
  }[] = [
    {
      label: lang === 'th' ? 'พื้นที่ทำงาน' : 'Workspace',
      links: [
        { href: '/admin', label: copy.overview, hint: copy.adminHome, exact: true, icon: 'overview' },
        { href: '/admin/quick-setup', label: copy.quickSetup, hint: copy.quickSetupHint, icon: 'quick' },
      ],
    },
    {
      label: lang === 'th' ? 'ตั้งค่าระบบ' : 'Setup',
      links: [
        { href: '/admin/companies', label: copy.companies, hint: copy.manageProfiles, icon: 'company' },
        { href: '/admin/organizations', label: copy.fleets, hint: copy.manageGroups, icon: 'fleet' },
        { href: '/admin/dashboards', label: copy.dashboardsNav, hint: copy.templatesAndLinks, icon: 'dashboard' },
      ],
    },
    {
      label: lang === 'th' ? 'การเข้าถึง' : 'Access',
      links: [
        { href: '/admin/line-channels', label: 'LINE', hint: 'LINE channels', icon: 'line' },
        { href: '/admin/users', label: copy.users, hint: copy.accessAndRoles, icon: 'user' },
      ],
    },
  ];

  return (
    <nav aria-label={copy.jumpToSection} className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-end lg:overflow-visible">
      {groups.map((group) => (
        <div key={group.label} className="shrink-0">
          <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">{group.label}</p>
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100/90 p-1 dark:bg-zinc-950/55">
            {group.links.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : (pathname?.startsWith(link.href) ?? false);
              return <NavPill key={link.href} {...link} icon={<NavIcon type={link.icon} />} isActive={isActive} />;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
