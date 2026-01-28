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
    <nav className="flex flex-wrap gap-2 text-sm text-[var(--app-text-muted)]">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-[var(--app-border-strong)] px-3 py-1 transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
