'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  normalizeDrivingThresholds,
  thresholdEntryLabel,
  thresholdEntryValue,
  type DrivingThresholdEntry,
  type DrivingThresholds,
} from './drivingThresholds';
import { saveDrivingThresholdsInline } from './drivingThresholdActions';

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
    if (entries.length >= 5) return;
    const entry: DrivingThresholdEntry = label.trim()
      ? { value: num, label: label.trim() }
      : num;
    onChange([...entries, entry]);
    setVal('');
    setLabel('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
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
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min="0.5"
          max="24"
          step="0.5"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="hours"
          className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="text"
          maxLength={32}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="label (optional)"
          className="w-44 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={add}
          disabled={entries.length >= 5}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          + add
        </button>
      </div>
    </div>
  );
}

export default function DrivingThresholdInlineEditor({
  dashboardRowId,
  dashboardPublicId,
  initialThresholds,
  lang,
  onSaved,
}: {
  dashboardRowId: number;
  dashboardPublicId: string;
  initialThresholds: unknown;
  lang: 'en' | 'th';
  onSaved?: (next: DrivingThresholds) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [thresholds, setThresholds] = useState<DrivingThresholds>(() =>
    normalizeDrivingThresholds(initialThresholds),
  );

  const isDirty = useMemo(
    () => JSON.stringify(thresholds) !== JSON.stringify(normalizeDrivingThresholds(initialThresholds)),
    [thresholds, initialThresholds],
  );

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveDrivingThresholdsInline({
          dashboardRowId,
          dashboardPublicId,
          thresholds,
        });
        onSaved?.(thresholds);
        setMessage({ type: 'success', text: lang === 'th' ? 'บันทึกแล้ว' : 'Saved' });
        window.setTimeout(() => {
          setIsOpen(false);
          setMessage(null);
        }, 1200);
      } catch {
        setMessage({ type: 'error', text: lang === 'th' ? 'บันทึกไม่สำเร็จ' : 'Failed to save' });
      }
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {lang === 'th' ? 'แก้ไข Thresholds' : 'Edit thresholds'}
      </button>

      {isOpen && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-2 text-xs text-zinc-500">
            {lang === 'th'
              ? 'Drive Hours ต่อวัน (>), Rest Hours ต่อกะ (<), ขับต่อเนื่อง (>)'
              : 'Drive Hours per day (>), Rest Hours per shift (<), Cnt Drv (>))'}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {lang === 'th' ? 'Drive Hours/วัน' : 'Drive Hours/day'}
              <div className="mt-1">
                <Chips
                  comparator=">"
                  entries={thresholds.driveHours}
                  onChange={(next) => setThresholds((t) => ({ ...t, driveHours: next }))}
                />
              </div>
            </label>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {lang === 'th' ? 'Rest Hours/กะ' : 'Rest Hours/shift'}
              <div className="mt-1">
                <Chips
                  comparator="<"
                  entries={thresholds.restHours}
                  onChange={(next) => setThresholds((t) => ({ ...t, restHours: next }))}
                />
              </div>
            </label>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {lang === 'th' ? 'ขับต่อเนื่อง' : 'Cnt Drv'}
              <div className="mt-1">
                <Chips
                  comparator=">"
                  entries={thresholds.cntDrvHours}
                  onChange={(next) => setThresholds((t) => ({ ...t, cntDrvHours: next }))}
                />
              </div>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending || !isDirty}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {isPending ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') : lang === 'th' ? 'บันทึก' : 'Save'}
            </button>
            {message ? (
              <span
                className={[
                  'rounded-md px-2 py-1 text-xs',
                  message.type === 'success'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                ].join(' ')}
              >
                {message.text}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
