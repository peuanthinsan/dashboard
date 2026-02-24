import { useMemo } from 'react';

type PieItem = {
  label: string;
  total: number;
};

type PieBreakdownProps = {
  title: string;
  description: string;
  items: PieItem[];
  emptyMessage: string;
};

const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#f97316'];

export default function PieBreakdown({ title, description, items, emptyMessage }: PieBreakdownProps) {
  const topItems = useMemo(() => items.slice(0, 6), [items]);
  const total = useMemo(() => topItems.reduce((sum, item) => sum + item.total, 0), [topItems]);

  const slices = useMemo(() => {
    if (total === 0) return [];
    let cumulative = 0;
    return topItems.map((item, index) => {
      const value = item.total;
      const start = cumulative;
      const ratio = value / total;
      cumulative += ratio;
      const startAngle = start * Math.PI * 2 - Math.PI / 2;
      const endAngle = cumulative * Math.PI * 2 - Math.PI / 2;
      const x1 = 50 + 40 * Math.cos(startAngle);
      const y1 = 50 + 40 * Math.sin(startAngle);
      const x2 = 50 + 40 * Math.cos(endAngle);
      const y2 = 50 + 40 * Math.sin(endAngle);
      const largeArc = ratio > 0.5 ? 1 : 0;
      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const percent = Math.round(ratio * 1000) / 10;
      return {
        ...item,
        color: PIE_COLORS[index % PIE_COLORS.length],
        path,
        percent,
      };
    });
  }, [topItems, total]);

  return (
    <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-white/90 via-indigo-50/80 to-cyan-100/70 p-5 dark:from-slate-900/60 dark:via-indigo-950/40 dark:to-cyan-950/30">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {slices.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[150px,1fr]">
          <svg viewBox="0 0 100 100" className="mx-auto h-36 w-36">
            {slices.map((slice) => (
              <path key={slice.label} d={slice.path} fill={slice.color} />
            ))}
            <circle cx="50" cy="50" r="22" fill="rgba(15,23,42,0.92)" />
            <text x="50" y="47" textAnchor="middle" className="fill-white text-[9px] uppercase tracking-[0.2em]">
              Total
            </text>
            <text x="50" y="58" textAnchor="middle" className="fill-white text-[11px] font-semibold">
              {total}
            </text>
          </svg>
          <div className="space-y-2">
            {slices.map((slice) => (
              <div key={slice.label} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-slate-700 dark:text-slate-200">{slice.label}</span>
                </div>
                <span className="font-semibold text-slate-600 dark:text-slate-300">{slice.total} · {slice.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
