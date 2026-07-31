'use client';

import { useActionState, useState, useEffect } from 'react';
import { btnPrimary, btnSecondary, btnSmall } from 'app/ui/design-tokens';
import { sendDrivingWarning, type SendDrivingWarningState } from './drivingWarnings';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import type { ViolationRow } from './dashboardDataUtils';

type LineChannelOption = { id: number; name: string };

const INITIAL: SendDrivingWarningState = { status: 'idle' };

type Props = {
  row: ViolationRow;
  dashboardPublicId: string;
  channels: LineChannelOption[];
  defaultChannelId: number | null;
  lang: DashboardLang;
};

export default function SendWarningButton({
  row,
  dashboardPublicId,
  channels,
  defaultChannelId,
  lang,
}: Props) {
  const copy = getDashboardCopy(lang).drivingV2;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(sendDrivingWarning, INITIAL);
  const [note, setNote] = useState('');
  const [channelId, setChannelId] = useState<number | null>(defaultChannelId ?? channels[0]?.id ?? null);

  useEffect(() => {
    if (state.status === 'success') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a completed server action is the external signal to close this local popover
      setOpen(false);
    }
  }, [state.status]);

  if (row.warning) {
    return (
      <span className="text-xs text-emerald-600">
        ✓ {row.warning.channelName}
      </span>
    );
  }

  if (channels.length === 0) {
    return (
      <button
        type="button"
        disabled
        className={`${btnSecondary} ${btnSmall} opacity-50`}
        title={copy.popoverErrorNoChannels}
      >
        {copy.warnButton}
      </button>
    );
  }

  const payload = {
    dashboardPublicId,
    lineChannelId: channelId,
    violation: row.metric === 'drive_hrs'
      ? {
          metric: 'drive_hrs' as const,
          driver: row.driver,
          vehicle: row.vehicle,
          eventAt: row.eventAt.toISOString(),
          threshold: row.threshold,
          valueHours: row.driveHours,
          distanceKm: row.distanceKm,
          loginAt: row.loginAt?.toISOString() ?? null,
          logoutAt: row.logoutAt?.toISOString() ?? null,
          loginLocation: row.loginLocation,
          logoutLocation: row.logoutLocation,
        }
      : row.metric === 'cnt_drv_hrs'
        ? {
            metric: 'cnt_drv_hrs' as const,
            driver: row.driver,
            vehicle: row.vehicle,
            eventAt: row.eventAt.toISOString(),
            threshold: row.threshold,
            valueHours: row.driveHours,
            distanceKm: row.distanceKm,
            loginAt: row.loginAt?.toISOString() ?? null,
            logoutAt: row.logoutAt?.toISOString() ?? null,
            loginLocation: row.loginLocation,
            logoutLocation: row.logoutLocation,
          }
        : {
            metric: 'rest_hrs' as const,
            driver: row.driver,
            vehicle: row.vehicle,
            eventAt: row.eventAt.toISOString(),
            threshold: row.threshold,
            valueHours: row.restHours,
            distanceKm: row.distanceKm,
            loginAt: row.loginAt?.toISOString() ?? null,
            logoutAt: row.logoutAt?.toISOString() ?? null,
            loginLocation: row.loginLocation,
            logoutLocation: row.logoutLocation,
          },
    operatorNote: note || undefined,
  };

  return (
    <div className="relative inline-block">
      <button type="button" className={`${btnPrimary} ${btnSmall}`} onClick={() => setOpen((v) => !v)}>
        {copy.warnButton}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-card dark:border-zinc-700 dark:bg-zinc-900">
          <form action={formAction}>
            <input type="hidden" name="payload" value={JSON.stringify(payload)} />
            <label className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {copy.popoverChannel}
              <select
                value={channelId ?? ''}
                onChange={(e) => setChannelId(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {copy.popoverNote}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
              />
            </label>
            {state.status === 'error' && (
              <p className="mt-2 text-xs text-red-600">{state.message}</p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => setOpen(false)}>
                {copy.popoverCancel}
              </button>
              <button type="submit" disabled={pending || !channelId} className={`${btnPrimary} ${btnSmall}`}>
                {pending ? copy.popoverSending : copy.popoverSend}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
