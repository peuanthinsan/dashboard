import { normalizeDrivingThresholds, thresholdEntryValue } from 'app/dashboards/drivingThresholds';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXT_MUTED } from '../admin-ui';

export function DrivingThresholdAdminFields({
  initial,
}: {
  initial?: unknown;
}) {
  const t = normalizeDrivingThresholds(initial);
  const driveDefault = t.driveHours[0] ? thresholdEntryValue(t.driveHours[0]) : 10;
  const restDefault = t.restHours[0] ? thresholdEntryValue(t.restHours[0]) : 10;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className={`${ADMIN_LABEL} mb-1`}>Driving template — thresholds (transitional UI, replaced in Task 23)</p>
      <p className={`mb-3 text-xs ${ADMIN_TEXT_MUTED}`}>
        Drive Hours threshold uses per-day totals; Rest Hours uses per-shift gaps. Work Hours dropped.
      </p>
      <input type="hidden" name="drivingThresholdsJson" defaultValue={JSON.stringify(t)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Drive Hrs/day &gt; (hours)
          <input
            name="_drivingDriveMax"
            type="number"
            step="0.5"
            min="0.5"
            defaultValue={driveDefault}
            className={ADMIN_INPUT}
          />
        </label>
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Rest Hrs &lt; (hours)
          <input
            name="_drivingRestMin"
            type="number"
            step="0.5"
            min="0.5"
            defaultValue={restDefault}
            className={ADMIN_INPUT}
          />
        </label>
      </div>
    </div>
  );
}
