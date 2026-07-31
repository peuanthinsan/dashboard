'use client';

import { useEffect, useRef, useState } from 'react';
import type { AlertRule } from 'app/dashboards/dashboardDataUtils';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_SELECT, ADMIN_TEXT_MUTED } from './admin-ui';
import { btnSecondary, btnSmall } from 'app/ui/design-tokens';

type RuleType = AlertRule['type'];

const RULE_TYPE_META: Record<RuleType, { label: string; description: string; color: string }> = {
  remap_alert_type: {
    label: 'Rename alert type',
    description: "Map a sheet alert type to a display label — e.g. 'Drinking-A2' shows as 'Eating/Drinking'",
    color: 'text-blue-600 dark:text-blue-400',
  },
  remap_alert_type_if_remark_contains: {
    label: 'Conditional rename (alert type + remark)',
    description: "Map to a target only if alert type matches AND the raw remark contains a substring — e.g. 'Eye Closing-A2' + 'fatigue' → 'Fatigue'",
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  remap_remark: {
    label: 'Normalize remark',
    description: "Unify spelling variations of the same remark — e.g. 'Eating & Drinking' → 'Eating/Drinking'",
    color: 'text-violet-600 dark:text-violet-400',
  },
  always_exclude: {
    label: 'Always exclude alert type',
    description: "Permanently hide all events of a specific alert type — e.g. a broken sensor that always fires",
    color: 'text-red-600 dark:text-red-400',
  },
  false_alert_speed: {
    label: 'False alert: below speed',
    description: "Hide events where the vehicle was below a speed threshold — e.g. 'Distraction' at < 40 km/h is likely a false trigger",
    color: 'text-amber-600 dark:text-amber-400',
  },
};

function ruleSummary(rule: AlertRule): React.ReactNode {
  const meta = RULE_TYPE_META[rule.type];
  switch (rule.type) {
    case 'remap_alert_type':
      return <><span className={`font-semibold ${meta.color}`}>Rename</span>{' '}alert type &quot;{rule.sourceAlertType}&quot; → remark &quot;{rule.targetRemark}&quot;</>;
    case 'remap_alert_type_if_remark_contains':
      return <><span className={`font-semibold ${meta.color}`}>Conditional rename</span>{' '}&quot;{rule.sourceAlertType}&quot; + remark contains &quot;{rule.remarkContains}&quot; → &quot;{rule.targetRemark}&quot;</>;
    case 'remap_remark':
      return <><span className={`font-semibold ${meta.color}`}>Normalize</span>{' '}&quot;{rule.sourceRemark}&quot; → &quot;{rule.targetRemark}&quot;</>;
    case 'always_exclude':
      return <><span className={`font-semibold ${meta.color}`}>Always exclude</span>{' '}alert type &quot;{rule.alertType}&quot;</>;
    case 'false_alert_speed':
      return <><span className={`font-semibold ${meta.color}`}>False alert</span>{' '}if remark = &quot;{rule.remark}&quot; AND speed &lt; {rule.maxSpeed} km/h</>;
  }
}

export default function AlertRulesEditor({ initial }: { initial?: AlertRule[] | null }) {
  const [rules, setRules] = useState<AlertRule[]>(initial ?? []);
  const [addType, setAddType] = useState<RuleType>('remap_alert_type');

  // Reset internal state when `initial` reference changes — the parent row
  // component stays mounted between modal opens, so without this the editor
  // would ship stale rules (and stale draft fields) from a previous row.
  const lastInitial = useRef(initial);
  useEffect(() => {
    if (initial !== lastInitial.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prop identity is the reset signal when the parent reuses this mounted editor
      setRules(initial ?? []);
      lastInitial.current = initial;
    }
  }, [initial]);

  // remap_alert_type fields
  const [srcAlertType, setSrcAlertType] = useState('');
  const [tgtRemark, setTgtRemark] = useState('');
  // remap_alert_type_if_remark_contains fields
  const [condSrcAlertType, setCondSrcAlertType] = useState('');
  const [condRemarkContains, setCondRemarkContains] = useState('');
  const [condTgtRemark, setCondTgtRemark] = useState('');
  // remap_remark fields
  const [srcRemark, setSrcRemark] = useState('');
  const [tgtRemapRemark, setTgtRemapRemark] = useState('');
  // always_exclude fields
  const [excludeAlertType, setExcludeAlertType] = useState('');
  // false_alert_speed fields
  const [faRemark, setFaRemark] = useState('');
  const [faSpeed, setFaSpeed] = useState('');

  const addRule = () => {
    const id = crypto.randomUUID();
    if (addType === 'remap_alert_type') {
      if (!srcAlertType.trim() || !tgtRemark.trim()) return;
      setRules((p) => [...p, { id, type: 'remap_alert_type', sourceAlertType: srcAlertType.trim(), targetRemark: tgtRemark.trim() }]);
      setSrcAlertType(''); setTgtRemark('');
    } else if (addType === 'remap_alert_type_if_remark_contains') {
      if (!condSrcAlertType.trim() || !condRemarkContains.trim() || !condTgtRemark.trim()) return;
      setRules((p) => [...p, { id, type: 'remap_alert_type_if_remark_contains', sourceAlertType: condSrcAlertType.trim(), remarkContains: condRemarkContains.trim(), targetRemark: condTgtRemark.trim() }]);
      setCondSrcAlertType(''); setCondRemarkContains(''); setCondTgtRemark('');
    } else if (addType === 'remap_remark') {
      if (!srcRemark.trim() || !tgtRemapRemark.trim()) return;
      setRules((p) => [...p, { id, type: 'remap_remark', sourceRemark: srcRemark.trim(), targetRemark: tgtRemapRemark.trim() }]);
      setSrcRemark(''); setTgtRemapRemark('');
    } else if (addType === 'always_exclude') {
      if (!excludeAlertType.trim()) return;
      setRules((p) => [...p, { id, type: 'always_exclude', alertType: excludeAlertType.trim() }]);
      setExcludeAlertType('');
    } else {
      if (!faRemark.trim() || !faSpeed.trim()) return;
      const maxSpeed = Number(faSpeed);
      if (!Number.isFinite(maxSpeed) || maxSpeed <= 0) return;
      setRules((p) => [...p, { id, type: 'false_alert_speed', remark: faRemark.trim(), maxSpeed }]);
      setFaRemark(''); setFaSpeed('');
    }
  };

  const removeRule = (id: string) => setRules((p) => p.filter((r) => r.id !== id));

  return (
    <div className="space-y-3">
      <input type="hidden" name="alertRulesJson" value={JSON.stringify(rules)} />

      {rules.length > 0 && (
        <div className="space-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-sm shadow-sm dark:bg-zinc-800">
              <span className="flex-1 text-zinc-700 dark:text-zinc-300">{ruleSummary(rule)}</span>
              <button type="button" onClick={() => removeRule(rule.id)} className="shrink-0 text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50 space-y-3">
        <div className="space-y-1">
          <label className={`text-xs ${ADMIN_LABEL} mb-0`}>Rule type</label>
          <select value={addType} onChange={(e) => setAddType(e.target.value as RuleType)} className={`${ADMIN_SELECT} text-xs py-1`}>
            {(Object.keys(RULE_TYPE_META) as RuleType[]).map((t) => (
              <option key={t} value={t}>{RULE_TYPE_META[t].label}</option>
            ))}
          </select>
          <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>{RULE_TYPE_META[addType].description}</p>
        </div>

        {addType === 'remap_alert_type' && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Alert type (from sheet)
              <input value={srcAlertType} onChange={(e) => setSrcAlertType(e.target.value)} placeholder="e.g. Drinking-A2" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <span className="text-zinc-400 pb-1">→</span>
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Show as remark
              <input value={tgtRemark} onChange={(e) => setTgtRemark(e.target.value)} placeholder="e.g. Eating/Drinking" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <button type="button" onClick={addRule} className={`${btnSecondary} ${btnSmall} self-end`}>Add</button>
          </div>
        )}

        {addType === 'remap_alert_type_if_remark_contains' && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Alert type
              <input value={condSrcAlertType} onChange={(e) => setCondSrcAlertType(e.target.value)} placeholder="e.g. Eye Closing-A2" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              + remark contains
              <input value={condRemarkContains} onChange={(e) => setCondRemarkContains(e.target.value)} placeholder="e.g. fatigue" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <span className="text-zinc-400 pb-1">→</span>
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Show as remark
              <input value={condTgtRemark} onChange={(e) => setCondTgtRemark(e.target.value)} placeholder="e.g. Fatigue" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <button type="button" onClick={addRule} className={`${btnSecondary} ${btnSmall} self-end`}>Add</button>
          </div>
        )}

        {addType === 'remap_remark' && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Remark in sheet
              <input value={srcRemark} onChange={(e) => setSrcRemark(e.target.value)} placeholder="e.g. Eating &amp; Drinking" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <span className="text-zinc-400 pb-1">→</span>
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Canonical label
              <input value={tgtRemapRemark} onChange={(e) => setTgtRemapRemark(e.target.value)} placeholder="e.g. Eating/Drinking" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <button type="button" onClick={addRule} className={`${btnSecondary} ${btnSmall} self-end`}>Add</button>
          </div>
        )}

        {addType === 'always_exclude' && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Alert type to hide
              <input value={excludeAlertType} onChange={(e) => setExcludeAlertType(e.target.value)} placeholder="e.g. Camera Error" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <span className="text-xs text-zinc-500 pb-1">→ always hidden</span>
            <button type="button" onClick={addRule} className={`${btnSecondary} ${btnSmall} self-end`}>Add</button>
          </div>
        )}

        {addType === 'false_alert_speed' && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Remark to check
              <input value={faRemark} onChange={(e) => setFaRemark(e.target.value)} placeholder="e.g. Distraction" className={`${ADMIN_INPUT} py-1 text-xs`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Below speed (km/h)
              <input type="number" min="1" value={faSpeed} onChange={(e) => setFaSpeed(e.target.value)} placeholder="e.g. 40" className={`${ADMIN_INPUT} py-1 text-xs w-24`} />
            </label>
            <span className="text-xs text-zinc-500 pb-1">→ hidden as false alert</span>
            <button type="button" onClick={addRule} className={`${btnSecondary} ${btnSmall} self-end`}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}
