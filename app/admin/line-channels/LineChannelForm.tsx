'use client';

import { useActionState, useState, useEffect } from 'react';
import { btnPrimary, btnSecondary } from 'app/ui/design-tokens';
import { ADMIN_INPUT, ADMIN_LABEL } from 'app/admin/admin-ui';
import type { LineChannelActionState } from './lineChannelActions';

type Channel = { id: number; organizationId: number; name: string; groupId: string } | null;

const INITIAL: LineChannelActionState = { status: 'idle' };

export function LineChannelForm({
  mode,
  organizationId,
  initial,
  action,
  onDone,
}: {
  mode: 'create' | 'update';
  organizationId: number;
  initial: Channel;
  action: (prev: LineChannelActionState, fd: FormData) => Promise<LineChannelActionState>;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [updateToken, setUpdateToken] = useState(mode === 'create');

  useEffect(() => {
    if (state.status === 'success') {
      onDone();
    }
  }, [state.status, onDone]);

  return (
    <form action={formAction} className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      {mode === 'update' && initial && <input type="hidden" name="id" value={initial.id} />}
      {mode === 'create' && <input type="hidden" name="organizationId" value={organizationId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Channel name
          <input name="name" defaultValue={initial?.name ?? ''} className={ADMIN_INPUT} required />
        </label>
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          LINE group / room / user ID
          <input name="groupId" defaultValue={initial?.groupId ?? ''} className={ADMIN_INPUT} required />
        </label>
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL} sm:col-span-2`}>
          Access token
          {mode === 'update' && !updateToken ? (
            <div className="flex items-center gap-2">
              <span className="font-mono">●●●●●●●●</span>
              <button type="button" className={btnSecondary} onClick={() => setUpdateToken(true)}>Update token</button>
            </div>
          ) : (
            <input
              name="accessToken"
              className={ADMIN_INPUT}
              required={mode === 'create'}
              placeholder="Bearer token from LINE Developer console"
              type="password"
            />
          )}
        </label>
      </div>
      {state.status === 'error' && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className={btnPrimary}>{mode === 'create' ? 'Create channel' : 'Save changes'}</button>
        <button type="button" className={btnSecondary} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
