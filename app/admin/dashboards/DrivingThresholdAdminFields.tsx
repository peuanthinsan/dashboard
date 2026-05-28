'use client';

import { useMemo, useState } from 'react';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXT_MUTED } from '../admin-ui';
import { btnSecondary, btnSmall } from 'app/ui/design-tokens';
import {
  normalizeDrivingThresholds,
  thresholdEntryValue,
  thresholdEntryLabel,
  type DrivingThresholds,
  type DrivingThresholdEntry,
} from 'app/dashboards/drivingThresholds';

function Chips({
  entries,
  comparator,
  onChange,
}: {
  entries: DrivingThresholdEntry[];
  comparator: '>' | '<';
  onChange: (next: DrivingThresholdEntry[]) => void;
}) {
  const [val, setVal] = useState('');
  const [label, setLabel] = useState('');

  function add() {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0 || num > 24) return;
    const entry: DrivingThresholdEntry = label.trim() ? { value: num, label: label.trim() } : num;
    if (entries.length >= 5) return;
    onChange([...entries, entry]);
    setVal(''); setLabel('');
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {entries.map((e, i) => {
          const v = thresholdEntryValue(e);
          const lbl = thresholdEntryLabel(e, `${comparator} ${v} h`);
          return (
            <span key={`${i}-${v}`} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
              {lbl}
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
                className="text-zinc-400 hover:text-red-500"
                aria-label={`remove ${lbl}`}
              >✕</button>
            </span>
          );
        })}
        {entries.length === 0 && <span className={`text-xs ${ADMIN_TEXT_MUTED}`}>No thresholds.</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="number" step="0.5" min="0.5" max="24" value={val} onChange={(e) => setVal(e.target.value)} placeholder="hours" className={`${ADMIN_INPUT} w-24`} />
        <input type="text" maxLength={32} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (optional)" className={`${ADMIN_INPUT} w-48`} />
        <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={add} disabled={entries.length >= 5}>
          + add
        </button>
      </div>
    </div>
  );
}

export function DrivingThresholdAdminFields({
  initial,
}: {
  initial?: unknown;
}) {
  const [thresholds, setThresholds] = useState<DrivingThresholds>(() => normalizeDrivingThresholds(initial));
  const json = useMemo(() => JSON.stringify(thresholds), [thresholds]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className={`${ADMIN_LABEL} mb-1`}>Driving thresholds</p>
      <p className={`mb-3 text-xs ${ADMIN_TEXT_MUTED}`}>
        Drive Hours uses per-day totals. Rest Hours uses per-shift gaps. Work Hours is not surfaced in v2.
        Each threshold renders one sub-page. Max 5 per metric.
      </p>
      <input type="hidden" name="drivingThresholdsJson" value={json} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Drive Hours / day (&gt; threshold)
          <Chips comparator=">" entries={thresholds.driveHours} onChange={(next) => setThresholds((t) => ({ ...t, driveHours: next }))} />
        </label>
        <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
          Rest Hours per shift (&lt; threshold)
          <Chips comparator="<" entries={thresholds.restHours} onChange={(next) => setThresholds((t) => ({ ...t, restHours: next }))} />
        </label>
      </div>
    </div>
  );
}
