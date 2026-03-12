import { CHART_COLORS } from './design-tokens';

type DonutSlice = { label: string; value: number };
type DonutChartProps = {
  data: DonutSlice[];
  title?: string;
  centerLabel?: string;
  size?: number;
  ariaLabel?: string;
};

export default function DonutChart({ data, title, centerLabel, size = 160, ariaLabel }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <p className="text-sm text-zinc-400 dark:text-zinc-500">No data</p>;
  const r = 15.9;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const resolvedAriaLabel =
    ariaLabel ??
    (title ? `${title}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}` : 'Alert distribution by type');

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 42 42"
        style={{ width: size, height: size }}
        className="shrink-0"
        role="img"
        aria-label={resolvedAriaLabel}
      >
        <circle
          cx="21"
          cy="21"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-zinc-100 dark:text-zinc-800"
        />
        {data.map((slice, i) => {
          const pct = slice.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={slice.label}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="3"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '21px 21px' }}
            />
          );
        })}
        <text
          x="21"
          y="20"
          textAnchor="middle"
          fontSize="4"
          fontWeight="bold"
          className="fill-zinc-900 dark:fill-zinc-50"
        >
          {total}
        </text>
        {centerLabel && (
          <text x="21" y="24" textAnchor="middle" fontSize="2.5" className="fill-zinc-400 dark:fill-zinc-500">
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="flex-1 space-y-1.5 text-sm">
        {title && <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">{title}</p>}
        {data.map((slice, i) => (
          <div key={slice.label} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                aria-hidden="true"
              />
              <span className="truncate text-zinc-700 dark:text-zinc-200">{slice.label}</span>
            </div>
            <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
              {slice.value}{' '}
              <span className="text-xs">({((slice.value / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
