const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HeatmapProps = { dates: Date[] };

export default function AlertHeatmap({ dates }: HeatmapProps) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxCount = 0;
  dates.forEach((d) => {
    const day = (d.getDay() + 6) % 7;
    const hour = d.getHours();
    grid[day][hour]++;
    maxCount = Math.max(maxCount, grid[day][hour]);
  });

  const getColor = (count: number) => {
    if (count === 0) return 'bg-zinc-100 dark:bg-zinc-800';
    const intensity = count / Math.max(1, maxCount);
    if (intensity > 0.75) return 'bg-red-500 dark:bg-red-500';
    if (intensity > 0.5) return 'bg-orange-400 dark:bg-orange-400';
    if (intensity > 0.25) return 'bg-amber-300 dark:bg-amber-400';
    return 'bg-emerald-300 dark:bg-emerald-600';
  };

  // Secondary visual cue: symbol shown inside cell when count > 0
  const getCellSymbol = (count: number) => {
    if (count === 0) return null;
    const intensity = count / Math.max(1, maxCount);
    if (intensity > 0.75) return '▪';
    if (intensity > 0.5) return '▪';
    if (intensity > 0.25) return '·';
    return '·';
  };

  const totalAlerts = dates.length;

  return (
    <div
      role="img"
      aria-label={`Alert heatmap showing ${totalAlerts} alerts distributed across days of the week and hours of the day`}
    >
      <div className="overflow-x-auto">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `auto repeat(24, 1fr)` }}>
          <div />
          {HOURS.map((h) => (
            <div key={h} className="text-center text-[9px] tabular-nums text-zinc-400">
              {String(h).padStart(2, '0')}
            </div>
          ))}
          {DAYS.map((day, di) => (
            <div key={day} className="contents">
              <div className="flex items-center justify-end pr-2 text-xs leading-none text-zinc-500">{day}</div>
              {HOURS.map((h) => {
                const count = grid[di][h];
                const symbol = getCellSymbol(count);
                return (
                  <div
                    key={`${di}-${h}`}
                    className={`relative flex h-4 w-4 items-center justify-center rounded-sm ${getColor(count)} transition-colors`}
                    title={`${day} ${String(h).padStart(2, '0')}:00 — ${count} alert${count !== 1 ? 's' : ''}`}
                    aria-label={`${day} ${String(h).padStart(2, '0')}:00, ${count} alert${count !== 1 ? 's' : ''}`}
                  >
                    {symbol && (
                      <span
                        className="pointer-events-none select-none text-[6px] font-bold leading-none text-white/80"
                        aria-hidden="true"
                      >
                        {symbol}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-400" aria-hidden="true">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="h-3 w-3 rounded-sm bg-zinc-100 dark:bg-zinc-800" title="0 alerts" />
            <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-600" title="Low" />
            <div className="h-3 w-3 rounded-sm bg-amber-300 dark:bg-amber-400" title="Moderate" />
            <div className="h-3 w-3 rounded-sm bg-orange-400" title="High" />
            <div className="h-3 w-3 rounded-sm bg-red-500" title="Very high" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
