'use client';

import { useState } from 'react';
import { CHART_COLORS } from './design-tokens';
import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip';

type DonutSlice = { label: string; value: number };
type DonutChartProps = {
  data: DonutSlice[];
  title?: string;
  centerLabel?: string;
  size?: number;
  ariaLabel?: string;
};

export default function DonutChart({ data, title, centerLabel, size = 160, ariaLabel }: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; rows: ChartTooltipRow[] }>({ visible: false, x: 0, y: 0, rows: [] });

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <p className="text-sm text-zinc-400 dark:text-zinc-500">No data</p>;
  const r = 15.9;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const resolvedAriaLabel =
    ariaLabel ??
    (title ? `${title}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}` : 'Alert distribution by type');

  // Pre-compute slice data (offsets must be cumulative, computed before render)
  const slices = data.map((slice, i) => {
    const pct = slice.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const currentOffset = offset;
    offset += dash;
    return { slice, i, pct, dash, gap, currentOffset };
  });

  const hoveredSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;
  const hoveredPct = hoveredSlice ? Math.round(hoveredSlice.pct * 100) : null;

  return (
    <>
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
        {slices.map(({ slice, i, dash, gap, currentOffset }) => {
          const isHovered = hoveredIndex === i;
          const pct = Math.round((slice.value / total) * 100);
          return (
            <circle
              key={slice.label}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={isHovered ? 4 : 3}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="round"
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '21px 21px',
                transition: 'stroke-width 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseMove={(e) => {
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  rows: [{ color: CHART_COLORS[i % CHART_COLORS.length], label: slice.label, value: slice.value }],
                });
              }}
              onMouseLeave={() => { setHoveredIndex(null); setTooltip(t => ({ ...t, visible: false })); }}
            />
          );
        })}
        {hoveredIndex !== null && hoveredPct !== null ? (
          <>
            <text
              x="21"
              y="19.5"
              textAnchor="middle"
              fontSize="5"
              fontWeight="bold"
              className="fill-zinc-900 dark:fill-zinc-50"
              style={{ pointerEvents: 'none' }}
            >
              {hoveredPct}%
            </text>
            <text
              x="21"
              y="24.5"
              textAnchor="middle"
              fontSize="2.2"
              className="fill-zinc-400 dark:fill-zinc-500"
              style={{ pointerEvents: 'none' }}
            >
              {data[hoveredIndex].label.length > 12
                ? data[hoveredIndex].label.slice(0, 12) + '…'
                : data[hoveredIndex].label}
            </text>
          </>
        ) : (
          <>
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
          </>
        )}
      </svg>
      <div className="flex-1 space-y-1.5 text-sm">
        {title && <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">{title}</p>}
        {data.map((slice, i) => (
          <div
            key={slice.label}
            className="flex cursor-default items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm transition-transform"
                style={{
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  transform: hoveredIndex === i ? 'scale(1.3)' : 'scale(1)',
                }}
                aria-hidden="true"
              />
              <span
                className="truncate transition-colors"
                style={{
                  color:
                    hoveredIndex === i
                      ? CHART_COLORS[i % CHART_COLORS.length]
                      : undefined,
                  fontWeight: hoveredIndex === i ? 600 : undefined,
                }}
              >
                {slice.label}
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
              {slice.value}{' '}
              <span className="text-xs">({((slice.value / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
    <ChartTooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} rows={tooltip.rows} />
    </>
  );
}
