import { GRADE_COLORS, gradeForCount } from 'app/dashboards/vehicleKpiUtils';

type GradeBadgeProps = {
  count: number;
  showNotAvailable?: boolean;
};

/** Displays an incident count beside its compact DHL letter-grade chip. */
export default function GradeBadge({ count, showNotAvailable = false }: GradeBadgeProps) {
  const grade = gradeForCount(count);
  const isNotAvailable = showNotAvailable && count === 0;

  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span>{count}{isNotAvailable ? ' (N/A)' : ''}</span>
      <span
        className="inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
        style={{ backgroundColor: GRADE_COLORS[grade] }}
        aria-label={`Grade ${grade}`}
      >
        {grade}
      </span>
    </span>
  );
}
