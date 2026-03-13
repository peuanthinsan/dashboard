'use client';

import { useMemo } from 'react';
import EmptyState from 'app/ui/EmptyState';
import { cardSection, heading2, heading3, textSecondary, badgeInfo } from 'app/ui/design-tokens';
import { formatDateTimeGB } from './dateFormat';

export interface VideoEntry {
  url: string;
  vehicle: string;
  driver: string;
  timestamp: Date;
  speed: string;
  alertType: string;
}

interface VideoEvidenceProps {
  entries: VideoEntry[];
  maxPerType?: number;
  lang?: 'en' | 'th';
}

export default function VideoEvidence({
  entries,
  maxPerType = 10,
  lang = 'en',
}: VideoEvidenceProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, VideoEntry[]>();
    for (const entry of entries) {
      const existing = map.get(entry.alertType);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entry.alertType, [entry]);
      }
    }

    const groups: { alertType: string; items: VideoEntry[] }[] = [];
    Array.from(map.entries()).forEach(([alertType, items]) => {
      const sorted = [...items]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, maxPerType);
      groups.push({ alertType, items: sorted });
    });
    return groups.sort((a, b) => a.alertType.localeCompare(b.alertType));
  }, [entries, maxPerType]);

  const totalCount = grouped.reduce((sum, g) => sum + g.items.length, 0);

  if (grouped.length === 0) {
    return (
      <div className={cardSection}>
        <h2 className={heading2}>
          {lang === 'th' ? 'วิดีโอล่าสุดตามประเภทการแจ้งเตือน' : 'Latest videos by alert type'}
        </h2>
        <EmptyState
          title={
            lang === 'th'
              ? 'ยังไม่พบวิดีโอที่ตรงกับประเภทการแจ้งเตือนที่เลือก'
              : 'No recent videos available for the selected alert types.'
          }
        />
      </div>
    );
  }

  return (
    <div className={cardSection}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={heading2}>
          {lang === 'th' ? 'วิดีโอล่าสุดตามประเภทการแจ้งเตือน' : 'Latest videos by alert type'}
        </h2>
        <span className={textSecondary}>
          {totalCount} {lang === 'th' ? 'ตัวอย่าง' : 'samples'}
        </span>
      </div>
      <div className="mt-5 space-y-5">
        {grouped.map((group) => (
          <article
            key={group.alertType}
            className="overflow-hidden rounded-xl border border-zinc-200/60 bg-zinc-50/50 dark:border-zinc-800/40 dark:bg-zinc-950/30"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 px-5 py-3 dark:border-zinc-800/40">
              <h3 className={heading3}>{group.alertType}</h3>
              <span className={textSecondary}>
                {group.items.length} / {maxPerType}{' '}
                {lang === 'th' ? 'รายการล่าสุด' : 'latest'}
              </span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item, idx) => (
                <div
                  key={`${item.url}-${idx}`}
                  className="group rounded-lg border border-zinc-200/60 bg-white p-4 transition-all duration-200 hover:border-red-200/60 hover:shadow-card dark:border-zinc-700/40 dark:bg-zinc-900/60 dark:hover:border-red-800/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.vehicle}
                      </p>
                      <p className={textSecondary}>{item.driver}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {formatDateTimeGB(item.timestamp)}
                      </p>
                      <p className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">{item.speed}</p>
                    </div>
                    <span className={badgeInfo}>{item.alertType}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200/60 bg-red-50/80 px-3 py-1.5 text-xs font-semibold text-red-700 transition-all duration-200 hover:bg-red-100 hover:shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {lang === 'th' ? 'ดูวิดีโอ' : 'Watch video'}
                  </a>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
