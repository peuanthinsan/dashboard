'use client';

type PieItem = {
  label: string;
  total: number;
};

type PieBreakdownCardProps = {
  items: PieItem[];
  emptyMessage: string;
};

const SEGMENT_COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#f59e0b',
  '#fb7185',
  '#22d3ee',
  '#818cf8',
];

export default function PieBreakdownCard({ items, emptyMessage }: PieBreakdownCardProps) {
  const totalCount = items.reduce((sum, item) => sum + item.total, 0);

  if (items.length === 0 || totalCount === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>;
  }

  let currentAngle = -90;
  const segments = items.map((item, index) => {
    const segmentAngle = (item.total / totalCount) * 360;
    const start = currentAngle;
    const end = currentAngle + segmentAngle;
    currentAngle = end;

    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = 50 + 38 * Math.cos(startRad);
    const y1 = 50 + 38 * Math.sin(startRad);
    const x2 = 50 + 38 * Math.cos(endRad);
    const y2 = 50 + 38 * Math.sin(endRad);
    const largeArcFlag = segmentAngle > 180 ? 1 : 0;

    return {
      ...item,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
      percent: (item.total / totalCount) * 100,
      path: `M 50 50 L ${x1} ${y1} A 38 38 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
    };
  });

  return (
    <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Pie chart breakdown">
          {segments.map((segment) => (
            <path key={segment.label} d={segment.path} fill={segment.color} stroke="rgba(15,23,42,0.2)" strokeWidth="0.8" />
          ))}
          <circle cx="50" cy="50" r="16" fill="rgba(15,23,42,0.85)" />
          <text x="50" y="47" textAnchor="middle" className="fill-slate-200 text-[7px] uppercase tracking-wide">
            Total
          </text>
          <text x="50" y="57" textAnchor="middle" className="fill-white text-[10px] font-semibold">
            {totalCount}
          </text>
        </svg>
      </div>

      <div className="space-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 dark:bg-slate-800/70">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="truncate text-sm text-slate-700 dark:text-slate-100">{segment.label}</span>
            </div>
            <div className="ml-3 flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{segment.total}</span>
              <span className="text-xs text-slate-500 dark:text-slate-300">{segment.percent.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
