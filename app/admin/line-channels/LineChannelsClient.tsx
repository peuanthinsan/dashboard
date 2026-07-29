'use client';

import { useState, useActionState } from 'react';
import { btnPrimary, btnDanger, btnSecondary, btnSmall, heading3, textSecondary } from 'app/ui/design-tokens';
import { LineChannelForm } from './LineChannelForm';
import type { LineChannelActionState } from './lineChannelActions';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';

type Organization = { id: number; name: string };
type Channel = { id: number; organizationId: number; name: string; groupId: string; createdAt: Date };

type Action = (prev: LineChannelActionState, fd: FormData) => Promise<LineChannelActionState>;

const INITIAL: LineChannelActionState = { status: 'idle' };

export function LineChannelsClient({
  organizations,
  channels,
  createAction,
  updateAction,
  deleteAction,
  testAction,
}: {
  organizations: Organization[];
  channels: Channel[];
  createAction: Action;
  updateAction: Action;
  deleteAction: Action;
  testAction: Action;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingForOrg, setCreatingForOrg] = useState<number | null>(null);
  const [delState, delAction] = useActionState(deleteAction, INITIAL);
  const [testState, testActionState] = useActionState(testAction, INITIAL);

  const channelsByOrg = new Map<number, Channel[]>();
  for (const c of channels) {
    const arr = channelsByOrg.get(c.organizationId) ?? [];
    arr.push(c);
    channelsByOrg.set(c.organizationId, arr);
  }

  return (
    <div className="flex flex-col gap-8">
      {(delState.status === 'error' || testState.status === 'error') && (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {delState.status === 'error' ? delState.message : ''}
          {testState.status === 'error' ? ` ${testState.message}` : ''}
        </div>
      )}
      {testState.status === 'success' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {testState.message}
        </div>
      )}
      {delState.status === 'success' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {delState.message}
        </div>
      )}

      {organizations.map((org) => (
        <section key={org.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <header className="mb-4 flex items-center justify-between">
            <h2 className={heading3}>{org.name}</h2>
            <button type="button" className={`${btnPrimary} ${btnSmall}`} onClick={() => setCreatingForOrg(org.id)}>
              + Add channel
            </button>
          </header>

          <ul className="flex flex-col gap-2">
            {(channelsByOrg.get(org.id) ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</div>
                  <div className={`text-xs ${textSecondary}`}>group: <code>{c.groupId}</code></div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => setEditingId(c.id)}>Edit</button>
                  <form action={testActionState}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={`${btnSecondary} ${btnSmall}`}>Test send</button>
                  </form>
                  <form action={delAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmDeleteDialog
                      title={`Delete ${c.name}`}
                      description="This permanently removes the LINE channel. Dashboards using it will no longer be able to send notifications through this channel."
                      triggerClassName={`${btnDanger} ${btnSmall}`}
                      confirmClassName={`${btnDanger} ${btnSmall}`}
                    />
                  </form>
                </div>
              </li>
            ))}
            {(channelsByOrg.get(org.id) ?? []).length === 0 && (
              <li className={`text-sm ${textSecondary}`}>No channels yet.</li>
            )}
          </ul>

          {creatingForOrg === org.id && (
            <LineChannelForm
              mode="create"
              organizationId={org.id}
              initial={null}
              action={createAction}
              onDone={() => setCreatingForOrg(null)}
            />
          )}
          {editingId !== null && channelsByOrg.get(org.id)?.some((c) => c.id === editingId) && (
            <LineChannelForm
              mode="update"
              organizationId={org.id}
              initial={channels.find((c) => c.id === editingId) ?? null}
              action={updateAction}
              onDone={() => setEditingId(null)}
            />
          )}
        </section>
      ))}
    </div>
  );
}
