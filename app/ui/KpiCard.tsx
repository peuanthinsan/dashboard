import { cardSection, textMuted, textSecondary } from './design-tokens';
import Tooltip from './Tooltip';

type KpiCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  accentColor?: string;
  tooltip?: string;
  children?: React.ReactNode;
};

export default function KpiCard({ label, value, unit, subtitle, trend, accentColor, tooltip, children }: KpiCardProps) {
  const trendColor = trend
    ? trend.value > 0
      ? 'text-red-600 dark:text-red-400'
      : trend.value < 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-zinc-400 dark:text-zinc-500'
    : '';
  const trendArrow = trend ? (trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→') : '';
  const trendBg = trend
    ? trend.value > 0
      ? 'bg-red-50 dark:bg-red-950/30'
      : trend.value < 0
        ? 'bg-emerald-50 dark:bg-emerald-950/30'
        : 'bg-zinc-50 dark:bg-zinc-800/30'
    : '';

  return (
    <Tooltip content={tooltip ?? ''}>
      <div
        className={`${cardSection} relative overflow-hidden animate-slide-up`}
        role="region"
        aria-label={label}
        style={
          accentColor
            ? { borderLeft: `3px solid ${accentColor}` }
            : undefined
        }
      >
        {/* Thai gold accent shimmer — top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" aria-hidden="true" />
        {/* Subtle decorative gradient */}
        <div
          className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.04]"
          style={{ background: accentColor ?? '#EF4444' }}
          aria-hidden="true"
        />
        <p className={`${textSecondary} font-medium`}>{label}</p>
        <p
          className={`mt-2 text-3xl font-bold tabular-nums tracking-tight animate-count-up${accentColor ? '' : ' text-zinc-900 dark:text-zinc-50'}`}
          style={accentColor ? { color: accentColor } : undefined}
        >
          {value}
          {unit && (
            <span className="ml-1.5 text-base font-normal text-zinc-400 dark:text-zinc-500">{unit}</span>
          )}
        </p>
        {trend ? (
          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${trendColor} ${trendBg}`}>
            {trendArrow} {Math.abs(trend.value)}% {trend.label}
          </span>
        ) : null}
        {subtitle ? <p className={`mt-1.5 ${textMuted}`}>{subtitle}</p> : null}
        {children}
      </div>
    </Tooltip>
  );
}
