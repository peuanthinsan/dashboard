'use client';

import { useMemo } from 'react';
import EmptyState from 'app/ui/EmptyState';
import { cardSection, heading2, heading3, textSecondary, textMuted, badgeInfo } from 'app/ui/design-tokens';
import { normalizeLabel } from './dashboardDataUtils';

// Reject anything that isn't a plain http(s) URL — sheet cells could contain
// `javascript:` or `data:` URIs that would execute on click.
function safeVideoHref(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    return null;
  } catch {
    return null;
  }
}
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
  /** Optional: alert-type → hex color map so chips match the donut/chart colors. */
  colorMap?: Map<string, string>;
}

export default function VideoEvidence({
  entries,
  maxPerType = 10,
  lang = 'en',
  colorMap,
}: VideoEvidenceProps) {
  const grouped = useMemo(() => {
    // Per-entry identity key: use driver when present, else fall back to vehicle.
    // Lets dashboards with missing driver data still show multiple clips per alert type.
    const subjectKey = (entry: VideoEntry) =>
      (entry.driver && entry.driver !== '—' ? entry.driver : entry.vehicle) || '—';

    // Count total alerts per subject (worst = most alerts)
    const subjectAlertCount = new Map<string, number>();
    for (const entry of entries) {
      const key = subjectKey(entry);
      subjectAlertCount.set(key, (subjectAlertCount.get(key) ?? 0) + 1);
    }

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
      // Sort: worst subjects first (most alerts), then latest timestamp
      const sorted = [...items].sort((a, b) => {
        const countA = subjectAlertCount.get(subjectKey(a)) ?? 0;
        const countB = subjectAlertCount.get(subjectKey(b)) ?? 0;
        if (countB !== countA) return countB - countA;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
      // One video per subject — take first (most recent) per worst subject
      const seen = new Set<string>();
      const unique: VideoEntry[] = [];
      for (const item of sorted) {
        const key = subjectKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
        if (unique.length >= maxPerType) break;
      }
      groups.push({ alertType, items: unique });
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

  const description =
    lang === 'th'
      ? 'จัดอันดับตามผู้ขับที่มีการแจ้งเตือนมากที่สุด โดยแสดงวิดีโอล่าสุด 1 คลิปต่อคนในแต่ละประเภท'
      : 'Ranked by drivers with the most alerts. One video per driver per alert type — showing their most recent incident.';

  return (
    <div className={cardSection}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={heading2}>
            {lang === 'th' ? 'วิดีโอล่าสุดตามประเภทการแจ้งเตือน' : 'Latest videos by alert type'}
          </h2>
          <p className={`mt-1 ${textMuted}`}>{description}</p>
        </div>
        <span className={`shrink-0 ${textSecondary}`}>
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
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
              {group.items.map((item, idx) => (
                <div
                  key={`${item.url}-${idx}`}
                  className="group flex min-w-0 flex-col rounded-lg border border-zinc-200/60 bg-white p-4 transition-all duration-200 hover:border-red-200/60 hover:shadow-card dark:border-zinc-700/40 dark:bg-zinc-900/60 dark:hover:border-red-800/40"
                >
                  {(() => {
                    const color = colorMap?.get(normalizeLabel(item.alertType));
                    if (!color) {
                      return <span className={`mb-2 shrink-0 self-start ${badgeInfo}`}>{item.alertType}</span>;
                    }
                    return (
                      <span
                        className="mb-2 inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                        style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}66` }}
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {item.alertType}
                      </span>
                    );
                  })()}
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.vehicle}
                    </p>
                    <p className={`truncate ${textSecondary}`}>{item.driver}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDateTimeGB(item.timestamp)}
                    </p>
                    <p className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                      {lang === 'th' ? 'ความเร็ว: ' : 'Speed: '}{item.speed}
                    </p>
                  </div>
                  {(() => {
                    const safeHref = safeVideoHref(item.url);
                    if (!safeHref) {
                      return (
                        <span
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          title="Video link is not a valid http(s) URL"
                        >
                          {lang === 'th' ? 'ลิงก์ไม่ถูกต้อง' : 'Invalid link'}
                        </span>
                      );
                    }
                    return (
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noreferrer noopener"
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
                    );
                  })()}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
