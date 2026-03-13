import Link from 'next/link';
import { textSecondary } from 'app/ui/design-tokens';

type DashboardCardProps = {
  id: string | null;
  name: string;
  template: string | null;
  sheetUrl: string;
  lang: 'en' | 'th';
};

const templateIcons: Record<string, string> = {
  Summary: '📊',
  Detail: '📋',
  Simple: '📈',
  Driving: '🚗',
};

const templateColors: Record<string, string> = {
  Summary: 'bg-red-50 text-red-700 ring-red-200/50 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/30',
  Detail: 'bg-blue-50 text-blue-700 ring-blue-200/50 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/30',
  Simple: 'bg-zinc-900 text-white ring-zinc-700/50 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600/30',
  Driving: 'bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/30',
};

const templateIconBg: Record<string, string> = {
  Summary: 'bg-red-50 ring-red-200/40 dark:bg-red-950/40 dark:ring-red-800/30',
  Detail: 'bg-blue-50 ring-blue-200/40 dark:bg-blue-950/40 dark:ring-blue-800/30',
  Simple: 'bg-zinc-100 ring-zinc-200/60 dark:bg-zinc-800 dark:ring-zinc-700/60',
  Driving: 'bg-emerald-50 ring-emerald-200/40 dark:bg-emerald-950/40 dark:ring-emerald-800/30',
};

export default function DashboardCard({ id, name, template, sheetUrl, lang }: DashboardCardProps) {
  const icon = templateIcons[template ?? ''] ?? '📊';
  const badgeColor =
    templateColors[template ?? ''] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-200/50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/30';
  const iconBg =
    templateIconBg[template ?? ''] ?? 'bg-zinc-50 ring-zinc-200/60 dark:bg-zinc-800 dark:ring-zinc-700/60';

  return (
    <Link
      href={`/dashboard/${id}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-zinc-200/60 bg-white/80 p-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-red-300/60 hover:shadow-card-hover hover:translate-y-[-2px] dark:border-zinc-800/60 dark:bg-zinc-900/80 dark:hover:border-red-800/60 animate-slide-up"
    >
      {/* Red accent top trim */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent transition-all duration-300 group-hover:via-red-500/60" />

      {/* Hover glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-500/0 transition-all duration-300 group-hover:bg-red-500/5 dark:group-hover:bg-red-500/10" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ring-1 ${iconBg}`}>
          {icon}
        </div>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeColor}`}>
          {template ?? 'Summary'}
        </span>
      </div>
      <div className="relative flex-1">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{name}</h3>
        <p className={`mt-1 line-clamp-1 ${textSecondary}`}>{sheetUrl}</p>
      </div>
      <div className="relative flex items-center justify-between border-t border-zinc-100/80 pt-3 dark:border-zinc-800/60">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" style={{ animationDuration: '3s' }} />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {lang === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected'}
          </span>
        </div>
        <span className="text-xs font-semibold text-red-600 transition-all duration-200 group-hover:translate-x-0.5 dark:text-red-400">
          {lang === 'th' ? 'เปิดแดชบอร์ด →' : 'Open dashboard →'}
        </span>
      </div>
    </Link>
  );
}
