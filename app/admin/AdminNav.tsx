import Link from 'next/link';

const NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/companies', label: 'Companies' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/dashboards', label: 'Dashboards' },
];

export default function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
