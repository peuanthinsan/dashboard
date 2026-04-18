import Tooltip from './Tooltip';
import { SAFETY_THRESHOLDS } from './design-tokens';

type ScoreBlockProps = {
  score: number;
  label: string;
  detail?: string;
  /** Optional tooltip explaining what the score means. */
  tooltip?: string;
};

export default function ScoreBlock({ score, label, detail, tooltip }: ScoreBlockProps) {
  const scoreColor =
    score >= SAFETY_THRESHOLDS.excellent
      ? 'bg-emerald-50/80 ring-emerald-200/60 dark:bg-emerald-950/50 dark:ring-emerald-800/40'
      : score >= SAFETY_THRESHOLDS.good
        ? 'bg-blue-50/80 ring-blue-200/60 dark:bg-blue-950/50 dark:ring-blue-800/40'
        : score >= SAFETY_THRESHOLDS.moderate
          ? 'bg-amber-50/80 ring-amber-200/60 dark:bg-amber-950/50 dark:ring-amber-800/40'
          : 'bg-red-50/80 ring-red-200/60 dark:bg-red-950/50 dark:ring-red-800/40';

  const textColor =
    score >= SAFETY_THRESHOLDS.excellent
      ? 'text-emerald-700 dark:text-emerald-300'
      : score >= SAFETY_THRESHOLDS.good
        ? 'text-blue-700 dark:text-blue-300'
        : score >= SAFETY_THRESHOLDS.moderate
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-red-700 dark:text-red-300';

  const block = (
    <div
      className={`flex flex-wrap items-baseline gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ${scoreColor}`}
    >
      <span className={`text-2xl font-bold tabular-nums ${textColor}`}>{score}</span>
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {detail && (
        <span className="ml-auto text-sm text-zinc-500 dark:text-zinc-400">{detail}</span>
      )}
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{block}</Tooltip>;
  }
  return block;
}
