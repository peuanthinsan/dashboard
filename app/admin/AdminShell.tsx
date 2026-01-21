import Link from 'next/link';

const NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/companies', label: 'Companies' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/dashboards', label: 'Dashboards' },
];

type AdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function AdminShell({ title, description, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
            >
              <span aria-hidden="true">←</span>
              Back to dashboards
            </Link>
            <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-slate-800 px-3 py-1 text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">{title}</h1>
            {description ? <p className="text-sm text-slate-300">{description}</p> : null}
          </div>
        </header>
        <div className="grid gap-6">{children}</div>
      </div>
    </div>
  );
}
