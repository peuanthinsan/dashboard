'use client';

import { useMemo } from 'react';
import { heading2, textMuted } from 'app/ui/design-tokens';

export type TelemetryPoint = {
  id: number;
  segmentKey: string;
  vehicleNo: string;
  timestamp: number;
  speed: number;
  ignitionOn: boolean | null;
};

type LocationTelemetryTimelineProps = {
  points: TelemetryPoint[];
  onSelectVehicle?: (vehicleNo: string) => void;
  lang?: 'en' | 'th';
};

export type TelemetryVehicleScope = {
  vehicleNo: string | null;
  vehicleOptions: string[];
  vehicleCount: number;
  hasUnidentifiedVehicle: boolean;
};

const WIDTH = 760;
const HEIGHT = 320;
const PAD = { top: 30, right: 28, bottom: 50, left: 48 };
const MAX_POINTS = 240;

function samplePoints<T>(values: T[], max: number): T[] {
  if (values.length <= max) return values;
  return Array.from({ length: max }, (_, index) => {
    const sourceIndex = Math.round((index * (values.length - 1)) / (max - 1));
    return values[sourceIndex]!;
  });
}

function formatTick(timestamp: number, includeDate: boolean) {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    ...(includeDate ? { day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

/** A speed/ignition trace is truthful only when every point belongs to one identified vehicle. */
export function resolveTelemetryVehicleScope(points: TelemetryPoint[]): TelemetryVehicleScope {
  const vehicleOptions = Array.from(new Set(
    points.map((point) => point.vehicleNo.trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));
  const hasUnidentifiedVehicle = points.some((point) => !point.vehicleNo.trim());
  const vehicleNo = vehicleOptions.length === 1 && !hasUnidentifiedVehicle
    ? vehicleOptions[0]!
    : null;

  return {
    vehicleNo,
    vehicleOptions,
    vehicleCount: vehicleOptions.length + (hasUnidentifiedVehicle ? 1 : 0),
    hasUnidentifiedVehicle,
  };
}

export default function LocationTelemetryTimeline({
  points,
  onSelectVehicle,
  lang = 'en',
}: LocationTelemetryTimelineProps) {
  const vehicleScope = useMemo(() => resolveTelemetryVehicleScope(points), [points]);
  const chart = useMemo(() => {
    if (!vehicleScope.vehicleNo) return null;
    const ordered = samplePoints(
      points
        .filter((point) =>
          point.vehicleNo.trim() === vehicleScope.vehicleNo && Number.isFinite(point.timestamp),
        )
        .sort((a, b) => a.timestamp - b.timestamp),
      MAX_POINTS,
    );
    if (ordered.length === 0) return null;
    const start = ordered[0]!.timestamp;
    const end = ordered[ordered.length - 1]!.timestamp;
    const span = Math.max(end - start, 1);
    const rawMax = Math.max(...ordered.map((point) => point.speed), 0);
    const maxSpeed = Math.max(20, Math.ceil(rawMax / 20) * 20);
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const mapped = ordered.map((point, index) => ({
      ...point,
      x: ordered.length === 1 ? PAD.left + plotWidth / 2 : PAD.left + ((point.timestamp - start) / span) * plotWidth,
      y: PAD.top + plotHeight - (Math.max(0, point.speed) / maxSpeed) * plotHeight,
      index,
    }));
    const grouped = new Map<string, typeof mapped>();
    mapped.forEach((point) => {
      const values = grouped.get(point.segmentKey) ?? [];
      values.push(point);
      grouped.set(point.segmentKey, values);
    });
    const segments = Array.from(grouped.entries()).map(([key, values]) => ({ key, values }));
    const speedPaths = segments.flatMap(({ key, values }) => {
      if (values.length < 2) return [];
      return [{
        key,
        path: values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '),
      }];
    });
    const areaPaths = speedPaths.map(({ key, path }) => {
      const values = grouped.get(key)!;
      return {
        key,
        path: `${path} L ${values[values.length - 1]!.x.toFixed(2)} ${(PAD.top + plotHeight).toFixed(2)} L ${values[0]!.x.toFixed(2)} ${(PAD.top + plotHeight).toFixed(2)} Z`,
      };
    });
    return { ordered, mapped, segments, start, end, maxSpeed, plotWidth, plotHeight, speedPaths, areaPaths };
  }, [points, vehicleScope.vehicleNo]);

  const labels = lang === 'th'
    ? {
        title: 'ความเร็วและการเปิดกุญแจ',
        hint: 'ความเร็วและสถานะกุญแจของรถหนึ่งคันตามช่วงเวลา',
        speed: 'ความเร็ว',
        ignition: 'กุญแจ ON',
        empty: 'ไม่มีข้อมูลเวลาในมุมมองนี้',
        selectOne: 'ข้อมูลความเร็วและกุญแจเป็นข้อมูลเฉพาะรถ กรุณาเลือกรถหนึ่งคันเพื่อดูเส้นเวลาที่ถูกต้อง',
        unidentified: 'ต้องมีเลขรถที่ระบุชัดเจนก่อนจึงจะแสดงเส้นเวลานี้ได้',
        chooseVehicle: 'เลือกรถ',
        selectPlaceholder: 'เลือกรถหนึ่งคัน…',
        vehicles: 'คันในมุมมองปัจจุบัน',
      }
    : {
        title: 'Speed & ignition timeline',
        hint: 'Speed and ignition state for one vehicle over time',
        speed: 'Speed',
        ignition: 'Ignition on',
        empty: 'No dated telemetry in this view.',
        selectOne: 'Speed and ignition are vehicle-specific. Select one vehicle to show a truthful timeline.',
        unidentified: 'An identified vehicle number is required before this timeline can be shown.',
        chooseVehicle: 'Choose a vehicle',
        selectPlaceholder: 'Select one vehicle…',
        vehicles: 'vehicles in the current view',
      };

  const needsVehicleSelection = points.length > 0 && !vehicleScope.vehicleNo;

  return (
    <section className="min-w-0" aria-labelledby="location-timeline-title">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h2 id="location-timeline-title" className={heading2}>{labels.title}</h2>
          <p className={`mt-1 ${textMuted}`}>
            {vehicleScope.vehicleNo ? `${vehicleScope.vehicleNo} · ${labels.hint}` : labels.hint}
          </p>
        </div>
        {vehicleScope.vehicleCount > 0 ? (
          <span className="inline-flex min-h-7 items-center rounded-full bg-zinc-100 px-3 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
            {vehicleScope.vehicleNo ?? `${vehicleScope.vehicleCount} ${labels.vehicles}`}
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
        {needsVehicleSelection ? (
          <div className="flex min-h-[260px] items-center justify-center px-6 py-8 text-center">
            <div className="w-full max-w-sm">
              <svg aria-hidden="true" className="mx-auto h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l4-5 4 3 4-7 4 3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 21h16M4 3v14" />
              </svg>
              <p
                className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100"
                role="status"
                aria-live="polite"
              >
                {vehicleScope.hasUnidentifiedVehicle && vehicleScope.vehicleOptions.length === 0
                  ? labels.unidentified
                  : labels.selectOne}
              </p>
              {onSelectVehicle && vehicleScope.vehicleOptions.length > 0 ? (
                <label className="mx-auto mt-5 block max-w-xs text-left">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {labels.chooseVehicle}
                  </span>
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) onSelectVehicle(event.target.value);
                    }}
                    className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-400/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">{labels.selectPlaceholder}</option>
                    {vehicleScope.vehicleOptions.map((vehicleNo) => (
                      <option key={vehicleNo} value={vehicleNo}>{vehicleNo}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        ) : chart ? (
          <>
            <svg
              className="block aspect-[19/8] min-h-[220px] w-full"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={`${labels.title}: ${chart.ordered.length} samples, maximum ${chart.maxSpeed} kilometres per hour scale`}
            >
              <defs>
                <linearGradient id="speed-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#16a34a" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#16a34a" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = PAD.top + chart.plotHeight - ratio * chart.plotHeight;
                const value = Math.round(chart.maxSpeed * ratio);
                return (
                  <g key={ratio}>
                    <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4 5" className="text-zinc-200 dark:text-zinc-800" />
                    <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" className="text-zinc-400">{value}</text>
                  </g>
                );
              })}
              {chart.segments.flatMap(({ values }) => values.slice(0, -1).map((point, index) => {
                if (point.ignitionOn !== true) return null;
                const next = values[index + 1]!;
                return (
                  <rect
                    key={`ignition-${point.id}`}
                    x={point.x}
                    y={PAD.top}
                    width={Math.max(1, next.x - point.x)}
                    height={chart.plotHeight}
                    fill="#f59e0b"
                    opacity="0.09"
                  />
                );
              }))}
              {chart.areaPaths.map(({ key, path }) => <path key={`area-${key}`} d={path} fill="url(#speed-area)" />)}
              {chart.speedPaths.map(({ key, path }) => <path key={`speed-${key}`} d={path} fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
              {chart.segments.flatMap(({ values }) => values.length === 1 ? (
                <circle key={`speed-point-${values[0]!.id}`} cx={values[0]!.x} cy={values[0]!.y} r="3" fill="#16a34a" />
              ) : [])}
              {chart.segments.flatMap(({ values }) => values.slice(0, -1).map((point, index) => {
                const next = values[index + 1]!;
                const y = HEIGHT - 27;
                return point.ignitionOn === true ? (
                  <line key={`ign-line-${point.id}`} x1={point.x} x2={next.x} y1={y} y2={y} stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
                ) : null;
              }))}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const timestamp = chart.start + (chart.end - chart.start) * ratio;
                const x = PAD.left + chart.plotWidth * ratio;
                return <text key={ratio} x={x} y={HEIGHT - 8} textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'} fontSize="10" fill="currentColor" className="text-zinc-400">{formatTick(timestamp, chart.end - chart.start >= 86_400_000)}</text>;
              })}
            </svg>
            <div className="flex flex-wrap items-center gap-5 border-t border-zinc-200/70 bg-white px-4 py-3 text-[11px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 rounded-full bg-green-600" />{labels.speed} (km/h)</span>
              <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-amber-500/80" />{labels.ignition}</span>
            </div>
          </>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center px-6 text-sm text-zinc-400 dark:text-zinc-500">
            {labels.empty}
          </div>
        )}
      </div>
    </section>
  );
}
