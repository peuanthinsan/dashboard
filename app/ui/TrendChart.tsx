'use client';

import { useState } from 'react';
import { buildYAxisTicks, computeNiceMax } from 'app/dashboards/dashboardDataUtils';
import { CHART_COLORS } from 'app/ui/design-tokens';
import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TrendDatum = { label: string; value: number };
export type MultiTrendDatum = { label: string; values: Record<string, number> };
export type TrendChartMode = 'line' | 'bar' | 'dual-axis';

type TooltipState = { visible: boolean; x: number; y: number; header: string; rows: ChartTooltipRow[] };
type SetTooltip = React.Dispatch<React.SetStateAction<TooltipState>>;

interface TrendChartProps {
  data: TrendDatum[] | MultiTrendDatum[];
  mode?: TrendChartMode;
  height?: number;
  colors?: string[];
  className?: string;
  ariaLabel?: string;
  /** Show every category with full labels (angled); extra bottom margin. Use for driver / entity names on bar charts. */
  xAxisCategoryMode?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime type discrimination
// ---------------------------------------------------------------------------

function isMultiTrendData(data: TrendDatum[] | MultiTrendDatum[]): data is MultiTrendDatum[] {
  if (data.length === 0) return false;
  return typeof (data[0] as MultiTrendDatum).values === 'object' && (data[0] as MultiTrendDatum).values !== null;
}

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 1200;
const BASE_PADDING = { top: 28, right: 56, bottom: 60, left: 80 } as const;
type ChartLayout = { top: number; right: number; bottom: number; left: number };

function getChartLayout(xAxisCategoryMode: boolean): ChartLayout {
  return xAxisCategoryMode ? { ...BASE_PADDING, bottom: 112 } : BASE_PADDING;
}

/** Format large Y-axis values to fit: 1200 → "1.2K", 50000 → "50K" */
function formatAxisValue(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toPrecision(3)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  if (v >= 1_000) return `${+(v / 1000).toPrecision(3)}K`;
  return String(v);
}

/** On-chart data label: up to 2 decimals, trailing zeros trimmed (4.20 → "4.2", 216.00 → "216"). */
function formatDataLabel(v: number): string {
  return String(+v.toFixed(2));
}

/** Beyond this many categories, on-chart data labels crowd — omit them. */
const MAX_DATA_LABEL_POINTS = 40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLinePath(
  points: Array<{ x: number; y: number }>,
): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
): string {
  if (points.length === 0) return '';
  const linePart = buildLinePath(points);
  const lastX = points[points.length - 1].x.toFixed(2);
  const firstX = points[0].x.toFixed(2);
  return `${linePart} L ${lastX} ${baselineY.toFixed(2)} L ${firstX} ${baselineY.toFixed(2)} Z`;
}

/** Map a value in [0, maxValue] to an SVG y coordinate within the plot area. */
function toY(value: number, maxValue: number, svgHeight: number, layout: ChartLayout): number {
  const plotHeight = svgHeight - layout.top - layout.bottom;
  return layout.top + (1 - value / Math.max(1, maxValue)) * plotHeight;
}

/** Map an index to an SVG x coordinate within the plot area. */
function toX(index: number, total: number, layout: ChartLayout): number {
  const plotWidth = SVG_WIDTH - layout.left - layout.right;
  if (total === 1) return layout.left + plotWidth / 2;
  return layout.left + (index / (total - 1)) * plotWidth;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function YAxisLeft({ svgHeight, maxValue, layout }: { svgHeight: number; maxValue: number; layout: ChartLayout }) {
  const ticks = buildYAxisTicks(maxValue, 4);
  const plotWidth = SVG_WIDTH - layout.left - layout.right;
  return (
    <>
      {ticks.map((tick) => {
        const y = layout.top + tick.position * (svgHeight - layout.top - layout.bottom);
        return (
          <g key={`y-left-${tick.value}`}>
            <line
              x1={layout.left}
              y1={y}
              x2={layout.left + plotWidth}
              y2={y}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-zinc-200 dark:text-zinc-700"
              strokeDasharray="4 4"
            />
            <text
              x={layout.left - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="13"
              className="fill-zinc-500 dark:fill-zinc-400"
            >
              {formatAxisValue(tick.value)}
            </text>
          </g>
        );
      })}
      {/* Y-axis line */}
      <line
        x1={layout.left}
        y1={layout.top}
        x2={layout.left}
        y2={svgHeight - layout.bottom}
        stroke="currentColor"
        strokeWidth="1"
        className="text-zinc-200 dark:text-zinc-700"
      />
    </>
  );
}

function YAxisRight({
  svgHeight,
  maxValue,
  label,
  layout,
}: {
  svgHeight: number;
  maxValue: number;
  label?: string;
  layout: ChartLayout;
}) {
  const ticks = buildYAxisTicks(maxValue, 4);
  const rightX = SVG_WIDTH - layout.right;
  return (
    <>
      {ticks.map((tick) => {
        const y = layout.top + tick.position * (svgHeight - layout.top - layout.bottom);
        return (
          <text
            key={`y-right-${tick.value}`}
            x={rightX + 10}
            y={y + 4}
            textAnchor="start"
            fontSize="13"
            className="fill-zinc-400 dark:fill-zinc-500"
          >
            {formatAxisValue(tick.value)}
          </text>
        );
      })}
      <line
        x1={rightX}
        y1={layout.top}
        x2={rightX}
        y2={svgHeight - layout.bottom}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="text-zinc-200 dark:text-zinc-700"
      />
      {label && (
        <text
          x={rightX + 8}
          y={layout.top - 8}
          fontSize="12"
          className="fill-zinc-400 dark:fill-zinc-500"
        >
          {label}
        </text>
      )}
    </>
  );
}

function XAxisLabels({
  labels,
  svgHeight,
  maxLabels = 8,
  categoryMode = false,
  layout,
}: {
  labels: string[];
  svgHeight: number;
  maxLabels?: number;
  categoryMode?: boolean;
  layout: ChartLayout;
}) {
  const count = labels.length;
  if (count === 0) return null;
  // Adaptive: fewer labels when lots of data points (skip in category mode — show every bar)
  const effectiveMax = categoryMode ? count : count > 20 ? Math.min(maxLabels, 6) : maxLabels;
  const step = count <= effectiveMax ? 1 : Math.ceil(count / effectiveMax);
  const axisY = svgHeight - layout.bottom;
  const baselineY = axisY + (categoryMode ? 10 : 22);
  const maxChars = categoryMode ? 10_000 : count > 12 ? 8 : 10;

  return (
    <>
      {labels
        .filter((_, i) => i % step === 0 || i === count - 1)
        .map((label, filteredIndex, arr) => {
          // Recover original index
          const origIndex =
            filteredIndex < arr.length - 1
              ? filteredIndex * step
              : count - 1;
          const x = toX(origIndex, count, layout);
          const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
          return (
            <text
              key={`x-${origIndex}-${label}`}
              x={x}
              y={baselineY}
              textAnchor={categoryMode ? 'end' : 'middle'}
              transform={categoryMode ? `rotate(-42 ${x} ${baselineY})` : undefined}
              fontSize="12"
              className="fill-zinc-500 dark:fill-zinc-400"
            >
              {text}
            </text>
          );
        })}
      {/* X-axis baseline */}
      <line
        x1={layout.left}
        y1={axisY}
        x2={SVG_WIDTH - layout.right}
        y2={axisY}
        stroke="currentColor"
        strokeWidth="1"
        className="text-zinc-200 dark:text-zinc-700"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Line mode
// ---------------------------------------------------------------------------

interface LineModeProps {
  data: TrendDatum[] | MultiTrendDatum[];
  svgHeight: number;
  colors: string[];
  setTooltip: SetTooltip;
  layout: ChartLayout;
  xAxisCategoryMode: boolean;
}

function LineMode({ data, svgHeight, colors, setTooltip, layout, xAxisCategoryMode }: LineModeProps) {
  if (data.length === 0) return null;

  const isMulti = isMultiTrendData(data);

  if (isMulti) {
    // Multi-series: one line per key in values
    const multiData = data as MultiTrendDatum[];
    const seriesKeys = Object.keys(multiData[0].values);
    const labels = multiData.map((d) => d.label);
    const rawMax = Math.max(1, ...multiData.flatMap((d) => Object.values(d.values)));
    const maxValue = computeNiceMax(rawMax, 4);

    return (
      <g>
        <YAxisLeft svgHeight={svgHeight} maxValue={maxValue} layout={layout} />
        <XAxisLabels labels={labels} svgHeight={svgHeight} categoryMode={xAxisCategoryMode} layout={layout} />
        {seriesKeys.map((key, si) => {
          const color = colors[si % colors.length];
          const points = multiData.map((d, i) => ({
            x: toX(i, multiData.length, layout),
            y: toY(d.values[key] ?? 0, maxValue, svgHeight, layout),
          }));
          const linePath = buildLinePath(points);
          return (
            <g key={key}>
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill={color}
                  onMouseMove={(e) =>
                    setTooltip({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      header: labels[i],
                      rows: seriesKeys.map((k, ki) => ({
                        color: colors[ki % colors.length],
                        label: k,
                        value: multiData[i].values[k] ?? 0,
                      })),
                    })
                  }
                  onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                />
              ))}
            </g>
          );
        })}
      </g>
    );
  }

  // Single series
  const singleData = data as TrendDatum[];
  const labels = singleData.map((d) => d.label);
  const rawMax = Math.max(1, ...singleData.map((d) => d.value));
  const maxValue = computeNiceMax(rawMax, 4);
  const color = colors[0];
  const baselineY = svgHeight - layout.bottom;

  const points = singleData.map((d, i) => ({
    x: toX(i, singleData.length, layout),
    y: toY(d.value, maxValue, svgHeight, layout),
  }));

  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, baselineY);

  return (
    <g>
      <YAxisLeft svgHeight={svgHeight} maxValue={maxValue} layout={layout} />
      <XAxisLabels labels={labels} svgHeight={svgHeight} categoryMode={xAxisCategoryMode} layout={layout} />
      {/* Area fill */}
      <path d={areaPath} fill={color} fillOpacity="0.08" stroke="none" />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill={color}
          onMouseMove={(e) =>
            setTooltip({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              header: labels[i],
              rows: [{ color, label: labels[i], value: singleData[i].value }],
            })
          }
          onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Bar mode
// ---------------------------------------------------------------------------

interface BarModeProps {
  data: TrendDatum[] | MultiTrendDatum[];
  svgHeight: number;
  colors: string[];
  setTooltip: SetTooltip;
  layout: ChartLayout;
  xAxisCategoryMode: boolean;
}

function BarMode({ data, svgHeight, colors, setTooltip, layout, xAxisCategoryMode }: BarModeProps) {
  if (data.length === 0) return null;

  const isMulti = isMultiTrendData(data);
  const plotWidth = SVG_WIDTH - layout.left - layout.right;
  const baselineY = svgHeight - layout.bottom;

  if (isMulti) {
    const multiData = data as MultiTrendDatum[];
    const seriesKeys = Object.keys(multiData[0].values);
    const labels = multiData.map((d) => d.label);
    const rawMax = Math.max(1, ...multiData.flatMap((d) => Object.values(d.values)));
    const maxValue = computeNiceMax(rawMax, 4);
    const groupWidth = plotWidth / multiData.length;
    const barPad = 0.15;
    const barWidth = (groupWidth * (1 - barPad * 2)) / seriesKeys.length;

    return (
      <g>
        <YAxisLeft svgHeight={svgHeight} maxValue={maxValue} layout={layout} />
        <XAxisLabels labels={labels} svgHeight={svgHeight} categoryMode={xAxisCategoryMode} layout={layout} />
        {multiData.map((d, gi) => {
          const groupX = layout.left + gi * groupWidth + groupWidth * barPad;
          return seriesKeys.map((key, si) => {
            const value = d.values[key] ?? 0;
            const barH = ((value / Math.max(1, maxValue)) * (svgHeight - layout.top - layout.bottom));
            const x = groupX + si * barWidth;
            const y = baselineY - barH;
            const color = colors[si % colors.length];
            return (
              <rect
                key={`${gi}-${key}`}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 2)}
                height={Math.max(0, barH)}
                fill={color}
                rx="2"
                onMouseMove={(e) =>
                  setTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    header: labels[gi],
                    rows: seriesKeys.map((k, ki) => ({
                      color: colors[ki % colors.length],
                      label: k,
                      value: d.values[k] ?? 0,
                    })),
                  })
                }
                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
              />
            );
          });
        })}
      </g>
    );
  }

  // Single series
  const singleData = data as TrendDatum[];
  const labels = singleData.map((d) => d.label);
  const rawMax = Math.max(1, ...singleData.map((d) => d.value));
  const maxValue = computeNiceMax(rawMax, 4);
  const barPad = 0.1;
  const barWidth = (plotWidth / singleData.length) * (1 - barPad * 2);
  const color = colors[0];

  return (
    <g>
      <YAxisLeft svgHeight={svgHeight} maxValue={maxValue} layout={layout} />
      <XAxisLabels labels={labels} svgHeight={svgHeight} categoryMode={xAxisCategoryMode} layout={layout} />
      {singleData.map((d, i) => {
        const slotWidth = plotWidth / singleData.length;
        const x = layout.left + i * slotWidth + slotWidth * barPad;
        const barH = (d.value / Math.max(1, maxValue)) * (svgHeight - layout.top - layout.bottom);
        const y = baselineY - barH;
        return (
          <rect
            key={`bar-${i}`}
            x={x}
            y={y}
            width={Math.max(1, barWidth)}
            height={Math.max(0, barH)}
            fill={color}
            rx="2"
            onMouseMove={(e) =>
              setTooltip({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                header: labels[i],
                rows: [{ color, label: labels[i], value: d.value }],
              })
            }
            onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
          />
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Dual-axis mode  (bars = first series key, line = second series key)
// ---------------------------------------------------------------------------

interface DualAxisModeProps {
  data: MultiTrendDatum[];
  svgHeight: number;
  colors: string[];
  setTooltip: SetTooltip;
  layout: ChartLayout;
  xAxisCategoryMode: boolean;
}

function DualAxisMode({ data, svgHeight, colors, setTooltip, layout, xAxisCategoryMode }: DualAxisModeProps) {
  if (data.length === 0) return null;

  const seriesKeys = Object.keys(data[0].values);
  const barKey = seriesKeys[0] ?? '';
  const lineKey = seriesKeys[1] ?? '';
  const labels = data.map((d) => d.label);

  const barValues = data.map((d) => d.values[barKey] ?? 0);
  const lineValues = data.map((d) => d.values[lineKey] ?? 0);

  const maxBarValue = computeNiceMax(Math.max(1, ...barValues), 4);
  const maxLineValue = computeNiceMax(Math.max(1, ...lineValues), 4);

  const plotWidth = SVG_WIDTH - layout.left - layout.right;
  const plotHeight = svgHeight - layout.top - layout.bottom;
  const baselineY = svgHeight - layout.bottom;

  const barColor = colors[0];
  const lineColor = colors[1] ?? colors[0];

  const barWidth = (plotWidth / data.length) * 0.6;
  const showLabels = data.length <= MAX_DATA_LABEL_POINTS;

  // Right-axis y mapping uses maxLineValue
  const linePoints = data.map((d, i) => ({
    x: toX(i, data.length, layout),
    y: layout.top + (1 - (d.values[lineKey] ?? 0) / maxLineValue) * plotHeight,
  }));
  const linePath = buildLinePath(linePoints);

  return (
    <g>
      {/* Left Y-axis (bars) */}
      <YAxisLeft svgHeight={svgHeight} maxValue={maxBarValue} layout={layout} />
      {/* Right Y-axis (line) */}
      {lineKey ? (
        <YAxisRight svgHeight={svgHeight} maxValue={maxLineValue} label={lineKey} layout={layout} />
      ) : null}
      <XAxisLabels labels={labels} svgHeight={svgHeight} categoryMode={xAxisCategoryMode} layout={layout} />

      {/* Bars */}
      {data.map((d, i) => {
        const barH = (barValues[i] / maxBarValue) * plotHeight;
        const slotWidth = plotWidth / data.length;
        const x = layout.left + i * slotWidth + (slotWidth - barWidth) / 2;
        const y = baselineY - barH;
        return (
          <rect
            key={`dual-bar-${i}`}
            x={x}
            y={y}
            width={Math.max(1, barWidth)}
            height={Math.max(0, barH)}
            fill={barColor}
            fillOpacity="0.75"
            rx="2"
            onMouseMove={(e) =>
              setTooltip({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                header: labels[i],
                rows: seriesKeys.map((k, ki) => ({
                  color: colors[ki % colors.length],
                  label: k,
                  value: d.values[k] ?? 0,
                })),
              })
            }
            onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
          />
        );
      })}

      {/* Bar value labels (always visible, no hover needed) */}
      {showLabels && data.map((d, i) => {
        const barH = (barValues[i] / maxBarValue) * plotHeight;
        const slotWidth = plotWidth / data.length;
        const cx = layout.left + i * slotWidth + slotWidth / 2;
        const top = baselineY - barH;
        const inside = barH >= 26;
        return (
          <text
            key={`dual-bar-label-${i}`}
            x={cx}
            y={inside ? top + 18 : top - 6}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill={inside ? '#ffffff' : barColor}
          >
            {formatDataLabel(barValues[i])}
          </text>
        );
      })}

      {/* Line (right axis) */}
      {lineKey ? (
        <>
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {linePoints.map((p, i) => (
            <circle
              key={`dual-dot-${i}`}
              cx={p.x}
              cy={p.y}
              r="4"
              fill={lineColor}
              onMouseMove={(e) =>
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  header: labels[i],
                  rows: seriesKeys.map((k, ki) => ({
                    color: colors[ki % colors.length],
                    label: k,
                    value: data[i].values[k] ?? 0,
                  })),
                })
              }
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            />
          ))}
          {/* Line value labels (always visible, no hover needed) */}
          {showLabels && linePoints.map((p, i) => (
            <text
              key={`dual-line-label-${i}`}
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill={lineColor}
            >
              {formatDataLabel(lineValues[i])}
            </text>
          ))}
        </>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

interface LegendProps {
  seriesKeys: string[];
  colors: string[];
  mode: TrendChartMode;
  barKey?: string;
  lineKey?: string;
}

function Legend({ seriesKeys, colors, mode, barKey, lineKey }: LegendProps) {
  if (seriesKeys.length <= 1 && mode !== 'dual-axis') return null;

  const items =
    mode === 'dual-axis' && barKey && lineKey
      ? [
          { label: barKey, color: colors[0], shape: 'rect' as const },
          { label: lineKey, color: colors[1] ?? colors[0], shape: 'line' as const },
        ]
      : seriesKeys.map((key, i) => ({ label: key, color: colors[i % colors.length], shape: 'line' as const }));

  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.shape === 'rect' ? (
            <span
              className="inline-block h-3 w-4 rounded-sm"
              style={{ backgroundColor: item.color, opacity: 0.75 }}
            />
          ) : (
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyChart({ svgHeight }: { svgHeight: number }) {
  return (
    <text
      x={SVG_WIDTH / 2}
      y={svgHeight / 2}
      textAnchor="middle"
      fontSize="18"
      className="fill-zinc-400 dark:fill-zinc-600"
    >
      No data
    </text>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TrendChart({
  data,
  mode = 'line',
  height = 300,
  colors = CHART_COLORS,
  className = '',
  ariaLabel,
  xAxisCategoryMode = false,
}: TrendChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, header: '', rows: [] });
  const svgHeight = height;
  const viewBox = `0 0 ${SVG_WIDTH} ${svgHeight}`;
  const isEmpty = data.length === 0;
  const layout = getChartLayout(xAxisCategoryMode);

  // Derive legend info
  const isMulti = !isEmpty && isMultiTrendData(data);
  const seriesKeys = isMulti ? Object.keys((data as MultiTrendDatum[])[0].values) : [];
  const dualBarKey = mode === 'dual-axis' && isMulti ? seriesKeys[0] : undefined;
  const dualLineKey = mode === 'dual-axis' && isMulti ? seriesKeys[1] : undefined;

  return (
    <div className={className}>
      <svg
        viewBox={viewBox}
        overflow="visible"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={ariaLabel ?? 'Trend chart'}
      >
        {isEmpty ? (
          <EmptyChart svgHeight={svgHeight} />
        ) : mode === 'line' ? (
          <LineMode
            data={data}
            svgHeight={svgHeight}
            colors={colors}
            setTooltip={setTooltip}
            layout={layout}
            xAxisCategoryMode={xAxisCategoryMode}
          />
        ) : mode === 'bar' ? (
          <BarMode
            data={data}
            svgHeight={svgHeight}
            colors={colors}
            setTooltip={setTooltip}
            layout={layout}
            xAxisCategoryMode={xAxisCategoryMode}
          />
        ) : mode === 'dual-axis' && isMulti ? (
          <DualAxisMode
            data={data as MultiTrendDatum[]}
            svgHeight={svgHeight}
            colors={colors}
            setTooltip={setTooltip}
            layout={layout}
            xAxisCategoryMode={xAxisCategoryMode}
          />
        ) : (
          // Fallback: dual-axis requested but single data provided — render as bar
          <BarMode
            data={data}
            svgHeight={svgHeight}
            colors={colors}
            setTooltip={setTooltip}
            layout={layout}
            xAxisCategoryMode={xAxisCategoryMode}
          />
        )}
      </svg>
      <Legend
        seriesKeys={seriesKeys}
        colors={colors}
        mode={mode}
        barKey={dualBarKey}
        lineKey={dualLineKey}
      />
      <ChartTooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        header={tooltip.header}
        rows={tooltip.rows}
        showTotal={tooltip.rows.length > 1}
      />
    </div>
  );
}
