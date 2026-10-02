'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatFuelTime, type FuelIncrease, type FuelReading } from './fuelData';

type Props = {
  readings: FuelReading[];
  increases: FuelIncrease[];
  mode: 'level' | 'increase';
  unit: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang?: 'en' | 'th';
};

const COLORS = ['#2563eb', '#7c3aed', '#0d9488', '#b45309', '#be185d', '#475569'];

/** Actual timestamp geometry; missing values and >10 minute gaps break continuity. */
export default function FuelTelemetryChart({ readings, increases, mode, unit, selectedId, onSelect, lang = 'en' }: Props) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const groups = useMemo(() => {
    const result = new Map<string, FuelReading[]>();
    for (const row of readings) {
      const rows = result.get(row.vehicle) ?? [];
      rows.push(row);
      result.set(row.vehicle, rows);
    }
    return Array.from(result.entries());
  }, [readings]);
  const values = mode === 'level' ? readings.flatMap((r) => r.fuel === null ? [] : [r.fuel]) : increases.map((r) => r.amount);
  const hasData = readings.length > 0 && values.length > 0;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)));
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasData]);
  if (!hasData) return <p className="py-14 text-center text-sm text-zinc-500">{mode === 'increase' ? (lang === 'th' ? 'ไม่มีค่าเพิ่มที่ผ่านเกณฑ์ในช่วงที่เลือก' : 'No increases meet the criteria in this selection.') : (lang === 'th' ? 'ไม่มีข้อมูลที่ตรงกับตัวกรอง' : 'No matching readings to plot.')}</p>;
  const compact = width < 640;
  const height = mode === 'level' ? 275 : 200;
  const left = compact ? 46 : 62, right = 24, top = 22, bottom = 42;
  const start = readings[0].timestamp;
  const end = readings[readings.length - 1].timestamp;
  const max = values.reduce((largest, value) => Math.max(largest, value), 1) * 1.08;
  const x = (timestamp: number) => start === end ? width / 2 : left + (timestamp - start) / (end - start) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const active = increases.find((r) => r.id === (hoveredId ?? selectedId));
  const title = mode === 'level' ? (lang === 'th' ? 'ระดับน้ำมันตามเวลา' : 'Fuel level over time') : (lang === 'th' ? 'ปริมาณที่เพิ่มขึ้นตามเวลา' : 'Detected increases over time');
  const crossDay = readings[0].day !== readings[readings.length - 1].day;
  const timeTickCount = compact ? 2 : 4;
  return (
    <div>
      <div ref={containerRef} role="region" aria-label={title}>
        <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="group" aria-labelledby={titleId}>
          <title id={titleId}>{title}. {unit}. {lang === 'th' ? 'เวลาไทย' : 'Bangkok time'}. {lang === 'th' ? 'ดูค่าที่แน่นอนในตารางข้อมูล' : 'Exact values are available in the data table below.'}</title>
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = max * tick / 4;
            return <g key={tick}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" strokeDasharray={tick ? '3 5' : undefined} />
              <text x={left - 12} y={y(value) + 4} textAnchor="end" fontSize="12" className="fill-zinc-500 dark:fill-zinc-400">{Number(value.toFixed(1))}</text>
            </g>;
          })}
          {Array.from({ length: timeTickCount + 1 }, (_, tick) => {
            const time = start + (end - start) * tick / timeTickCount;
            const label = compact
              ? `${crossDay ? `${formatFuelTime(time, true).slice(0, 5)} ` : ''}${formatFuelTime(time).slice(0, 5)}`
              : formatFuelTime(time, crossDay);
            return <text key={tick} x={x(time)} y={height - 13} textAnchor={tick === 0 ? 'start' : tick === timeTickCount ? 'end' : 'middle'} fontSize="12" className="fill-zinc-500 dark:fill-zinc-400">{label}</text>;
          })}
          {mode === 'level' && groups.map(([vehicle, rows], index) => {
            let previous: FuelReading | null = null;
            const path = rows.map((row) => {
              if (row.fuel === null) { previous = null; return ''; }
              const connected = previous && row.timestamp > previous.timestamp && row.timestamp - previous.timestamp <= 600_000;
              const segment = `${connected ? 'L' : 'M'}${x(row.timestamp).toFixed(2)},${y(row.fuel).toFixed(2)}`;
              previous = row;
              return segment;
            }).join(' ');
            return <g key={vehicle}>
              <path data-fuel-line={vehicle} d={path} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {rows.filter((r, i) => r.fuel !== null && (i === 0 || i === rows.length - 1 || rows[i - 1].fuel === null || r.timestamp - rows[i - 1].timestamp > 600_000)).map((r) => <circle key={r.id} cx={x(r.timestamp)} cy={y(r.fuel!)} r="3" fill={COLORS[index % COLORS.length]} />)}
            </g>;
          })}
          {increases.map((event) => {
            const px = x(event.after.timestamp);
            const py = y(mode === 'level' ? event.after.fuel! : event.amount);
            const selected = event.id === (hoveredId ?? selectedId);
            const label = `${event.vehicle}, ${formatFuelTime(event.after.timestamp, true)}, +${event.amount.toFixed(2)} ${unit}`;
            return <g key={event.id} tabIndex={0} role="button" aria-label={label} aria-pressed={selectedId === event.id}
              onMouseEnter={() => setHoveredId(event.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(event.id)} onBlur={() => setHoveredId(null)}
              onClick={() => onSelect(event.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(event.id); } }} className="cursor-pointer outline-none">
              <title>{label}</title>
              {mode === 'increase' && <line data-fuel-increase={event.id} x1={px} x2={px} y1={y(0)} y2={py} stroke={selected ? '#9a3412' : '#f97316'} strokeWidth={selected ? 7 : 4} />}
              <circle cx={px} cy={py} r={selected ? 6 : 4} fill="#f97316" stroke={selected ? '#18181b' : '#fff'} strokeWidth={selected ? 3 : 1.5} />
              <circle cx={px} cy={py} r="15" fill="transparent" />
            </g>;
          })}
        </svg>
      </div>
      {mode === 'level' && <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">{groups.map(([vehicle], index) => <span key={vehicle} className="inline-flex items-center gap-2"><span className="h-0.5 w-5" style={{ background: COLORS[index % COLORS.length] }} />{vehicle}</span>)}<span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" />{lang === 'th' ? 'ค่าที่เพิ่มขึ้น' : 'Detected increase'}</span></div>}
      <div className="mt-3 min-h-6 text-xs tabular-nums text-zinc-600 dark:text-zinc-300" aria-live="polite">{active ? `${active.vehicle} · ${formatFuelTime(active.after.timestamp, true)} · ${active.before.fuel?.toFixed(2)} → ${active.after.fuel?.toFixed(2)} · +${active.amount.toFixed(2)} ${unit}` : (lang === 'th' ? 'เลือกจุดสีส้มเพื่อดูค่าก่อนและหลัง' : 'Select an orange marker to inspect its before and after readings.')}</div>
    </div>
  );
}
