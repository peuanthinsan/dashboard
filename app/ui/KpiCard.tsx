import { cardSection, textMuted, textSecondary } from './design-tokens';

type KpiCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  accentColor?: string;
  children?: React.ReactNode;
};

export default function KpiCard({ label, value, unit, subtitle, trend, accentColor, children }: KpiCardProps) {
  // Positive trend (value > 0) is bad (more alerts), so red. Negative is good, so green.
  const trendColor = trend
    ? trend.value > 0
      ? 'text-red-600 dark:text-red-400'
      : trend.value < 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-zinc-400 dark:text-zinc-500'
    : '';
  const trendArrow = trend ? (trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→') : '';

  return (
    <div
      className={cardSection}
      role="region"
      aria-label={label}
      style={
        accentColor
          ? { borderLeft: `3px solid ${accentColor}` }
          : undefined
      }
    >
      <p className={textSecondary}>{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight${accentColor ? '' : ' text-zinc-900 dark:text-zinc-50'}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
        {unit && (
          <span className="ml-1 text-base font-normal text-zinc-500 dark:text-zinc-400">{unit}</span>
        )}
      </p>
      {trend ? (
        <p className={`mt-1 text-xs font-medium ${trendColor}`}>
          {trendArrow} {Math.abs(trend.value)}% {trend.label}
        </p>
      ) : null}
      {subtitle ? <p className={`mt-1 ${textMuted}`}>{subtitle}</p> : null}
      {children}
    </div>
  );
}
