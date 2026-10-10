import type { DriverRosterSettings } from 'app/dashboards/driverRoster';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_SELECT } from '../admin-ui';

export function DriverRosterAdminFields({ initial }: { initial?: DriverRosterSettings | null }) {
  return <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
    <legend className="px-1 text-sm font-semibold">Driver roster (optional)</legend>
    <p className="text-xs text-zinc-500">Include every listed driver, even with zero alerts. Keep one driver assignment per vehicle and fleet. The source sheet is read-only.</p>
    <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>Roster tab link
      <input name="driverRosterUrl" type="url" className={ADMIN_INPUT} defaultValue={initial ? `https://docs.google.com/spreadsheets/d/${initial.sheetId}/edit#gid=${initial.sheetGid}` : ''} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…" />
    </label>
    <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>Fleet when the roster has no Fleet column
      <input name="driverRosterFleet" className={ADMIN_INPUT} maxLength={128} defaultValue={initial?.defaultFleet ?? ''} placeholder="SERVICE" />
    </label>
    <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>Driver names on alerts
      <select name="driverRosterNamePolicy" className={ADMIN_SELECT} defaultValue={initial?.namePolicy ?? 'recorded'}>
        <option value="recorded">Preserve the driver recorded on each alert</option>
        <option value="vehicle">Use the current roster name for matching vehicles</option>
      </select>
    </label>
    <p className="text-xs text-zinc-500">Using current roster names also changes how older alerts are grouped. It does not edit the original alert sheet. Clear the tab link to disconnect the roster.</p>
  </fieldset>;
}
