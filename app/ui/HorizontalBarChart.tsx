'use client';

import { useState } from 'react';
import { CHART_COLORS } from './design-tokens';
import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip';

type BarItem = { label: string; value: number };

type HorizontalBarChartProps = {
  data: BarItem[];
  maxItems?: number;
  colors?: string[];
  ariaLabel?: string;
};

export default function HorizontalBarChart({
  data,
  maxItems = 5,
  colors = CHART_COLORS,
  ariaLabel,
}: HorizontalBarChartProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    rows: ChartTooltipRow[];
  }>({ visible: false, x: 0, y: 0, rows: [] });

  const items = data.slice(0, maxItems);
  const maxValue = Math.max(1, ...items.map((d) => d.value));

  if (items.length === 0) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">No data</p>;
  }

  return (
    <div role="img" aria-label={ariaLabel ?? 'Horizontal bar chart'}>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const pct = Math.max(2, (item.value / maxValue) * 100);
          const color = colors[i % colors.length];
          return (
            <div
              key={item.label}
              className="group"
              onMouseMove={(e) =>
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  rows: [{ color, label: item.label, value: item.value }],
                })
              }
              onMouseLeave={() =>
                setTooltip((t) => ({ ...t, visible: false }))
              }
            >
              <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words leading-snug text-zinc-700 dark:text-zinc-300">
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {item.value}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <ChartTooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        rows={tooltip.rows}
      />
    </div>
  );
}
