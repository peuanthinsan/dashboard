import Link from 'next/link';
import { cardHover, textSecondary } from 'app/ui/design-tokens';

type DashboardCardProps = {
  id: string | null;
  name: string;
  template: string | null;
  sheetUrl: string;
  lang: 'en' | 'th';
};

const templateIcons: Record<string, string> = {
  Summary: '⚓',
  Detail: '🗺️',
  Simple: '🏴‍☠️',
  Driving: '🚗',
};

const templateColors: Record<string, string> = {
  Summary: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  Detail: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  Simple: 'bg-zinc-900 text-white dark:bg-zinc-700 dark:text-zinc-100',
  Driving: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

export default function DashboardCard({ id, name, template, sheetUrl, lang }: DashboardCardProps) {
  const icon = templateIcons[template ?? ''] ?? '⚓';
  const badgeColor =
    templateColors[template ?? ''] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';

  return (
    <Link href={`/dashboard/${id}`} className={`${cardHover} group flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">
          {icon}
        </div>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
          {template ?? 'Summary'}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{name}</h3>
        <p className={`mt-1 line-clamp-1 ${textSecondary}`}>{sheetUrl}</p>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {lang === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected'}
          </span>
        </div>
        <span className="text-xs font-medium text-red-600 transition group-hover:text-red-500 dark:text-red-400">
          {lang === 'th' ? 'เปิดแดชบอร์ด →' : 'Open dashboard →'}
        </span>
      </div>
    </Link>
  );
}
