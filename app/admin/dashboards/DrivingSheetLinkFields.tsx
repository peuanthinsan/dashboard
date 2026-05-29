'use client';

import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXT_MUTED } from '../admin-ui';

type Props = {
  shiftSheetUrl?: string | null;
  cntDrvSheetUrl?: string | null;
  onShiftSheetUrlChange?: (value: string) => void;
};

export function DrivingSheetLinkFields({ shiftSheetUrl, cntDrvSheetUrl, onShiftSheetUrlChange }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className={`${ADMIN_LABEL} mb-1`}>Driving data sources</p>
      <p className={`mb-3 text-xs ${ADMIN_TEXT_MUTED}`}>
        Use two tabs from the same spreadsheet: shift/work hours (drive + rest) and continuous drive segments (Cnt Drv).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Shift / work hours sheet link *
          <input
            name="sheetUrl"
            value={onShiftSheetUrlChange ? (shiftSheetUrl ?? '') : undefined}
            defaultValue={onShiftSheetUrlChange ? undefined : (shiftSheetUrl ?? '')}
            onChange={onShiftSheetUrlChange ? (e) => onShiftSheetUrlChange(e.target.value) : undefined}
            placeholder="https://docs.google.com/spreadsheets/d/...#gid=0"
            className={ADMIN_INPUT}
            required
          />
          <span className={`text-xs ${ADMIN_TEXT_MUTED}`}>DriveHrs and RestHrs (login/logout shifts)</span>
        </label>
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Continuous drive sheet link
          <input
            name="sheetUrlCntDrv"
            defaultValue={cntDrvSheetUrl ?? ''}
            placeholder="https://docs.google.com/spreadsheets/d/...#gid=412401625"
            className={ADMIN_INPUT}
          />
          <span className={`text-xs ${ADMIN_TEXT_MUTED}`}>Cnt Drv Hr (start/end segments). Leave empty to hide Cnt Drv sub-pages.</span>
        </label>
      </div>
    </div>
  );
}
