'use client';

import { useMemo, useState, useTransition } from 'react';
import { type AlertRule, alertRuleSignature } from 'app/dashboards/dashboardDataUtils';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_SELECT } from './admin-ui';
import { btnDanger, btnSecondary, btnSmall } from 'app/ui/design-tokens';
import ConfirmActionDialog from './ConfirmActionDialog';

type OwnerWithRules = { id: number; name: string | null; alertRules?: AlertRule[] | null };

type EditAction = (ids: number[], signature: string, replacement: AlertRule) => Promise<{ updated: number }>;
type RemoveAction = (ids: number[], signature: string) => Promise<{ updated: number }>;

type Props = {
  /** Owners (dashboards or companies) currently in scope — usually the selected rows. */
  owners: OwnerWithRules[];
  ownerLabel: string; // "dashboard" / "company"
  editAction: EditAction;
  removeAction: RemoveAction;
  onChanged?: () => void; // called after successful edit/remove so parent can refresh
};

function describeRule(rule: AlertRule): string {
  switch (rule.type) {
    case 'remap_alert_type':
      return `Rename alert type "${rule.sourceAlertType}" → "${rule.targetRemark}"`;
    case 'remap_alert_type_if_remark_contains':
      return `Conditional rename "${rule.sourceAlertType}" + remark contains "${rule.remarkContains}" → "${rule.targetRemark}"`;
    case 'remap_remark':
      return `Normalize "${rule.sourceRemark}" → "${rule.targetRemark}"`;
    case 'always_exclude':
      return `Always exclude alert type "${rule.alertType}"`;
    case 'false_alert_speed':
      return `False alert: "${rule.remark}" + speed < ${rule.maxSpeed} km/h`;
  }
}

export default function ExistingRulesTable({ owners, ownerLabel, editAction, removeAction, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingSig, setEditingSig] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [pendingRemove, setPendingRemove] = useState<{ sig: string; ownerIds: number[] } | null>(null);

  // Group rules by signature across owners
  const grouped = useMemo(() => {
    const map = new Map<string, { sample: AlertRule; ownerIds: Set<number>; ownerNames: string[] }>();
    for (const owner of owners) {
      const rules = owner.alertRules ?? [];
      for (const rule of rules) {
        const sig = alertRuleSignature(rule);
        const entry = map.get(sig) ?? { sample: rule, ownerIds: new Set<number>(), ownerNames: [] };
        entry.ownerIds.add(owner.id);
        if (!entry.ownerNames.includes(owner.name ?? '(unnamed)')) {
          entry.ownerNames.push(owner.name ?? '(unnamed)');
        }
        map.set(sig, entry);
      }
    }
    return Array.from(map.entries()).map(([sig, v]) => ({ sig, ...v }));
  }, [owners]);

  if (owners.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">Select {ownerLabel}(s) to see their rules.</p>;
  }

  if (grouped.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">No alert rules on the selected {ownerLabel}(s).</p>;
  }

  return (
    <div className="space-y-2">
      {status && <p className="text-xs text-emerald-600 dark:text-emerald-400">{status}</p>}
      <div className="space-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
        {grouped.map(({ sig, sample, ownerIds, ownerNames }) => {
          const isEditing = editingSig === sig;
          return (
            <div key={sig} className="rounded bg-white p-2 shadow-sm dark:bg-zinc-800">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-700 dark:text-zinc-300">{describeRule(sample)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    on {ownerIds.size} {ownerLabel}{ownerIds.size === 1 ? '' : 's'}
                    {ownerNames.length <= 3 ? `: ${ownerNames.join(', ')}` : `: ${ownerNames.slice(0, 3).join(', ')} +${ownerNames.length - 3}`}
                  </p>
                </div>
                {!isEditing && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingSig(sig)}
                      disabled={isPending}
                      className={`${btnSecondary} ${btnSmall}`}
                      aria-label={`Edit rule: ${describeRule(sample)}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPendingRemove({ sig, ownerIds: Array.from(ownerIds) })}
                      className={`${btnDanger} ${btnSmall}`}
                      aria-label={`Remove rule: ${describeRule(sample)}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {isEditing && (
                <EditForm
                  rule={sample}
                  ownerCount={ownerIds.size}
                  ownerLabel={ownerLabel}
                  onCancel={() => setEditingSig(null)}
                  onSave={(next) => {
                    startTransition(async () => {
                      const result = await editAction(Array.from(ownerIds), sig, next);
                      setStatus(`Updated rule on ${result.updated} ${ownerLabel}(s).`);
                      setEditingSig(null);
                      onChanged?.();
                    });
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <ConfirmActionDialog
        isOpen={pendingRemove !== null}
        title="Remove alert rule"
        description={
          pendingRemove
            ? `Remove this rule from ${pendingRemove.ownerIds.length} ${ownerLabel}${pendingRemove.ownerIds.length === 1 ? '' : 's'}? This cannot be undone.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove) return;
          const { ownerIds, sig } = pendingRemove;
          startTransition(async () => {
            const result = await removeAction(ownerIds, sig);
            setStatus(`Removed rule from ${result.updated} ${ownerLabel}(s).`);
            onChanged?.();
          });
        }}
      />
    </div>
  );
}

function EditForm({
  rule,
  ownerCount,
  ownerLabel,
  onCancel,
  onSave,
}: {
  rule: AlertRule;
  ownerCount: number;
  ownerLabel: string;
  onCancel: () => void;
  onSave: (next: AlertRule) => void;
}) {
  const [draft, setDraft] = useState<AlertRule>(rule);

  const update = (patch: Partial<AlertRule>) => setDraft((d) => ({ ...d, ...patch } as AlertRule));

  return (
    <div className="mt-2 grid gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
      <select
        value={draft.type}
        onChange={(e) => {
          const t = e.target.value as AlertRule['type'];
          if (t === draft.type) return;
          // reset to a sensible empty shape when the type changes
          if (t === 'remap_alert_type') setDraft({ id: draft.id, type: t, sourceAlertType: '', targetRemark: '' });
          else if (t === 'remap_alert_type_if_remark_contains') setDraft({ id: draft.id, type: t, sourceAlertType: '', remarkContains: '', targetRemark: '' });
          else if (t === 'remap_remark') setDraft({ id: draft.id, type: t, sourceRemark: '', targetRemark: '' });
          else if (t === 'always_exclude') setDraft({ id: draft.id, type: t, alertType: '' });
          else setDraft({ id: draft.id, type: t, remark: '', maxSpeed: 40 });
        }}
        className={`${ADMIN_SELECT} text-xs py-1`}
      >
        <option value="remap_alert_type">Rename alert type</option>
        <option value="remap_alert_type_if_remark_contains">Conditional rename (alert type + remark)</option>
        <option value="remap_remark">Normalize remark</option>
        <option value="always_exclude">Always exclude alert type</option>
        <option value="false_alert_speed">False alert: below speed</option>
      </select>

      {draft.type === 'remap_alert_type' && (
        <div className="grid grid-cols-2 gap-2">
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Alert type
            <input value={draft.sourceAlertType} onChange={(e) => update({ sourceAlertType: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Show as remark
            <input value={draft.targetRemark} onChange={(e) => update({ targetRemark: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
        </div>
      )}
      {draft.type === 'remap_alert_type_if_remark_contains' && (
        <div className="grid grid-cols-3 gap-2">
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Alert type
            <input value={draft.sourceAlertType} onChange={(e) => update({ sourceAlertType: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Remark contains
            <input value={draft.remarkContains} onChange={(e) => update({ remarkContains: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Show as
            <input value={draft.targetRemark} onChange={(e) => update({ targetRemark: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
        </div>
      )}
      {draft.type === 'remap_remark' && (
        <div className="grid grid-cols-2 gap-2">
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Remark in sheet
            <input value={draft.sourceRemark} onChange={(e) => update({ sourceRemark: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Canonical label
            <input value={draft.targetRemark} onChange={(e) => update({ targetRemark: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
        </div>
      )}
      {draft.type === 'always_exclude' && (
        <label className={`text-xs ${ADMIN_LABEL}`}>
          Alert type to hide
          <input value={draft.alertType} onChange={(e) => update({ alertType: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
        </label>
      )}
      {draft.type === 'false_alert_speed' && (
        <div className="grid grid-cols-2 gap-2">
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Remark
            <input value={draft.remark} onChange={(e) => update({ remark: e.target.value })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
          <label className={`text-xs ${ADMIN_LABEL}`}>
            Below speed (km/h)
            <input type="number" min="1" value={draft.maxSpeed} onChange={(e) => update({ maxSpeed: Number(e.target.value) })} className={`${ADMIN_INPUT} py-1 text-xs`} />
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${btnSecondary} ${btnSmall}`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className={`${btnSecondary} ${btnSmall} !bg-blue-600 !text-white hover:!bg-blue-700`}
        >
          Apply edit to {ownerCount} {ownerLabel}{ownerCount === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}
