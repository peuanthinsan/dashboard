type DriverEntry = { name: string; score: number; alertCount: number; trend?: number };
type DriverLeaderboardProps = { drivers: DriverEntry[]; title?: string; variant?: 'safest' | 'riskiest' };

export default function DriverLeaderboard({ drivers, title, variant = 'safest' }: DriverLeaderboardProps) {
  const sorted = [...drivers]
    .sort((a, b) => (variant === 'safest' ? b.score - a.score : a.score - b.score))
    .slice(0, 5);

  // Medal background/text colors chosen for ≥4.5:1 contrast on both light and dark
  // Gold: amber-700 on amber-100 (light) / amber-300 on amber-900 (dark)
  // Silver: zinc-700 on zinc-100 (light) / zinc-200 on zinc-700 (dark)
  // Bronze: orange-700 on orange-100 (light) / orange-300 on orange-900 (dark)
  const getMedalColor = (index: number) => {
    if (index === 0) return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    if (index === 1) return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200';
    if (index === 2) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    return 'bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400';
  };

  // Medal aria-label for screen readers
  const getMedalLabel = (index: number) => {
    if (index === 0) return 'Gold medal, rank 1';
    if (index === 1) return 'Silver medal, rank 2';
    if (index === 2) return 'Bronze medal, rank 3';
    return `Rank ${index + 1}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'moderate';
    return 'poor';
  };

  return (
    <div>
      {title && <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>}
      <div className="space-y-2" role="list" aria-label={title ?? (variant === 'safest' ? 'Safest drivers' : 'Riskiest drivers')}>
        {sorted.map((driver, i) => (
          <div
            key={driver.name}
            role="listitem"
            className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            aria-label={`${getMedalLabel(i)}: ${driver.name}, safety score ${driver.score} (${getScoreLabel(driver.score)}), ${driver.alertCount} alerts`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${getMedalColor(i)}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{driver.name}</p>
              <p className="text-xs text-zinc-400">{driver.alertCount} alerts</p>
            </div>
            <span
              className={`text-lg font-bold tabular-nums ${getScoreColor(driver.score)}`}
              aria-label={`Score: ${driver.score}`}
            >
              {driver.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
