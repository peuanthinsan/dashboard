'use client';

import { useMemo } from 'react';
import EmptyState from 'app/ui/EmptyState';
import { cardSection, heading2, textSecondary, badgeDefault } from 'app/ui/design-tokens';

export interface TimelineEntry {
  timestamp: Date;
  vehicle: string;
  driver: string;
  alertType: string;
  speed: string;
}

interface AlertTimelineProps {
  entries: TimelineEntry[];
  maxEntries?: number;
  lang?: 'en' | 'th';
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Determine which entries should be highlighted because the same driver
 * appears multiple times within 2 hours in the sorted list.
 */
function computeHighlights(entries: TimelineEntry[]): Set<number> {
  const highlighted = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const diff = Math.abs(entries[i].timestamp.getTime() - entries[j].timestamp.getTime());
      if (diff > TWO_HOURS_MS) break; // sorted desc, so further entries are even further apart
      if (entries[i].driver === entries[j].driver) {
        highlighted.add(i);
        highlighted.add(j);
      }
    }
  }
  return highlighted;
}

export default function AlertTimeline({
  entries,
  maxEntries = 30,
  lang = 'en',
}: AlertTimelineProps) {
  const sorted = useMemo(
    () =>
      [...entries]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, maxEntries),
    [entries, maxEntries],
  );

  const highlights = useMemo(() => computeHighlights(sorted), [sorted]);

  if (sorted.length === 0) {
    return (
      <div className={cardSection}>
        <h2 className={heading2}>{lang === 'th' ? 'ไทม์ไลน์การแจ้งเตือน' : 'Alert Timeline'}</h2>
        <EmptyState
          title={lang === 'th' ? 'ไม่มีการแจ้งเตือน' : 'No alerts to display'}
          description={
            lang === 'th'
              ? 'ยังไม่มีรายการที่ตรงกับตัวกรอง'
              : 'No entries match the current filters.'
          }
        />
      </div>
    );
  }

  return (
    <div className={cardSection}>
      <h2 className={heading2}>{lang === 'th' ? 'ไทม์ไลน์การแจ้งเตือน' : 'Alert Timeline'}</h2>
      <p className={`mt-1 ${textSecondary}`}>
        {lang === 'th'
          ? `${sorted.length} รายการล่าสุด`
          : `${sorted.length} most recent entries`}
      </p>
      <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/50">
        {sorted.map((entry, index) => {
          const isHighlighted = highlights.has(index);
          const isEven = index % 2 === 0;
          return (
            <div
              key={`${entry.timestamp.getTime()}-${entry.vehicle}-${index}`}
              className={[
                'flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm',
                isEven
                  ? 'bg-white dark:bg-zinc-900'
                  : 'bg-zinc-50 dark:bg-zinc-900/60',
                isHighlighted ? 'border-l-3 border-l-indigo-500' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="w-12 shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {formatTime(entry.timestamp)}
              </span>
              <span className="w-20 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {formatShortDate(entry.timestamp)}
              </span>
              <span className="min-w-[6rem] font-medium text-zinc-900 dark:text-zinc-100">
                {entry.vehicle}
              </span>
              <span className="min-w-[6rem] text-zinc-700 dark:text-zinc-300">
                {entry.driver}
              </span>
              <span className={badgeDefault}>{entry.alertType}</span>
              <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                {entry.speed}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
