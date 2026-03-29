import { normalizeDrivingThresholds } from 'app/dashboards/drivingThresholds';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXT_MUTED } from '../admin-ui';

export function DrivingThresholdAdminFields({
  initial,
}: {
  initial?: unknown;
}) {
  const t = normalizeDrivingThresholds(initial);
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className={`${ADMIN_LABEL} mb-1`}>Driving template — violation thresholds (hours)</p>
      <p className={`mb-3 text-xs ${ADMIN_TEXT_MUTED}`}>
        Used when the template is Driving. Continuous driving counts as a violation above the first value; rest when below the
        second (only if rest hours are recorded on the row); working hours when above the third (only if working hours are
        recorded). Match your sheet columns (e.g. Cnt Drv Hr, Rest, Working Hr).
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Cnt drv &gt; (hours)
          <input
            name="drivingContinuousMax"
            type="number"
            step="0.1"
            min="0.1"
            defaultValue={t.continuousDrivingMaxHours}
            className={ADMIN_INPUT}
          />
        </label>
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Rest &lt; (hours)
          <input
            name="drivingRestMin"
            type="number"
            step="0.1"
            min="0.1"
            defaultValue={t.restMinimumHours}
            className={ADMIN_INPUT}
          />
        </label>
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Working hrs &gt; (hours)
          <input
            name="drivingWorkingMax"
            type="number"
            step="0.1"
            min="0.1"
            defaultValue={t.workingHoursMax}
            className={ADMIN_INPUT}
          />
        </label>
      </div>
    </div>
  );
}
