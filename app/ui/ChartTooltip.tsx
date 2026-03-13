'use client';

import { createPortal } from 'react-dom';
import { tooltipBase } from './design-tokens';

export type ChartTooltipRow = {
  color: string;
  label: string;
  value: number;
};

type ChartTooltipProps = {
  visible: boolean;
  x: number;
  y: number;
  header?: string;
  rows: ChartTooltipRow[];
  showTotal?: boolean;
};

export default function ChartTooltip({ visible, x, y, header, rows, showTotal }: ChartTooltipProps) {
  if (!visible || rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const flipUp = y > 100;
  const top = flipUp ? y - 12 : y + 12;

  return createPortal(
    <div
      role="tooltip"
      className={`${tooltipBase} pointer-events-none fixed z-[9999] min-w-[140px] -translate-x-1/2 px-3 py-2.5`}
      style={{ left: x, top, transform: `translate(-50%, ${flipUp ? '-100%' : '0'})` }}
    >
      {header && (
        <div className="mb-1.5 text-[10px] font-semibold text-zinc-400">{header}</div>
      )}
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-1.5 py-0.5">
          <span
            className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <span className="flex-1">{row.label}</span>
          <span className="font-semibold tabular-nums">{row.value.toLocaleString()}</span>
        </div>
      ))}
      {showTotal && rows.length > 1 && (
        <div className="mt-1 flex justify-between border-t border-zinc-700 pt-1">
          <span className="text-zinc-400">Total</span>
          <span className="font-bold tabular-nums">{total.toLocaleString()}</span>
        </div>
      )}
      <span
        className="absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent"
        style={flipUp
          ? { bottom: '-10px', borderTopColor: '#18181b' }
          : { top: '-10px', borderBottomColor: '#18181b' }
        }
      />
    </div>,
    document.body,
  );
}
