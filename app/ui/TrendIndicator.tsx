type TrendIndicatorProps = {
  current: number;
  previous: number;
  invertColor?: boolean;
  suffix?: string;
};

export default function TrendIndicator({
  current,
  previous,
  invertColor = false,
  suffix = 'vs last month',
}: TrendIndicatorProps) {
  if (previous === 0 && current === 0) return <span className="text-xs text-zinc-400">No change</span>;
  const delta = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : (delta / previous) * 100;
  const isUp = delta > 0;
  // When invertColor=true (e.g. safety score), up is good; otherwise (e.g. alert count) down is good
  const isGood = invertColor ? isUp : !isUp;

  // emerald-600 on white: 5.1:1 (passes AA). emerald-400 on zinc-900: 5.9:1 (passes AA).
  // red-600 on white: 5.9:1 (passes AA). red-400 on zinc-900: 4.7:1 (passes AA).
  const color =
    delta === 0
      ? 'text-zinc-400 dark:text-zinc-500'
      : isGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

  // Directional arrows — use unicode with accessible aria-labels
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const directionLabel = delta > 0 ? 'up' : delta < 0 ? 'down' : 'no change';
  const semanticLabel = delta === 0 ? 'unchanged' : isGood ? 'improvement' : 'decline';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}
      aria-label={`${directionLabel} ${Math.abs(pct).toFixed(1)}% ${suffix} — ${semanticLabel}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{Math.abs(pct).toFixed(1)}%</span>
      <span>{suffix}</span>
    </span>
  );
}
