import { SAFETY_THRESHOLDS } from './design-tokens';
import Tooltip from './Tooltip';

type SafetyScoreProps = {
  score: number;
  size?: number;
  label?: string;
  tooltip?: string;
};

// Stroke colors chosen for >= 3:1 contrast on both white and zinc-900 backgrounds.
// Emerald-500 / Blue-500 / Amber-500 / Red-500 all clear 3:1 on dark; text classes
// use the -600 / -400 split for WCAG AA on light / dark surfaces respectively.
const getScoreColor = (score: number) => {
  if (score >= SAFETY_THRESHOLDS.excellent)
    return { stroke: '#22c55e', text: 'text-emerald-600 dark:text-emerald-400', label: 'Excellent' };
  if (score >= SAFETY_THRESHOLDS.good)
    return { stroke: '#3b82f6', text: 'text-blue-600 dark:text-blue-400', label: 'Good' };
  if (score >= SAFETY_THRESHOLDS.moderate)
    return { stroke: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', label: 'Moderate' };
  return { stroke: '#ef4444', text: 'text-red-600 dark:text-red-400', label: 'Poor' };
};

export default function SafetyScore({ score, size = 120, label, tooltip }: SafetyScoreProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const { stroke, text, label: ratingLabel } = getScoreColor(clamped);
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const filled = (clamped / 100) * circumference;
  const displayLabel = label ?? ratingLabel;
  const ariaLabel = `Safety score: ${clamped} out of 100, ${displayLabel}`;

  return (
    <Tooltip content={tooltip ?? ''}>
      <div className="flex flex-col items-center gap-1">
        <svg
          viewBox="0 0 100 100"
          style={{ width: size, height: size }}
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-zinc-100 dark:text-zinc-800"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px' }}
          />
          <text
            x="50"
            y="46"
            textAnchor="middle"
            fontSize="18"
            fontWeight="bold"
            className="fill-zinc-900 dark:fill-zinc-50"
            aria-hidden="true"
          >
            {clamped}
          </text>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fontSize="8"
            className="fill-zinc-400 dark:fill-zinc-500"
            aria-hidden="true"
          >
            / 100
          </text>
        </svg>
        <span className={`text-sm font-semibold ${text}`} aria-hidden="true">
          {displayLabel}
        </span>
      </div>
    </Tooltip>
  );
}
