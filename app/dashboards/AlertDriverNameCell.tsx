'use client';

import { useState, useTransition } from 'react';
import { saveAlertDriverName } from './alertDriverActions';

/**
 * Inline editor for the manual driver-name override on one alert row.
 * Renders in the rightmost column of the Detail dashboard alerts table.
 */
export default function AlertDriverNameCell({
  dashboardPublicId,
  alertKey,
  overrideName,
  lang,
  onSaved,
}: {
  dashboardPublicId: string;
  alertKey: string;
  /** Current manual override, or empty string when none is set. */
  overrideName: string;
  lang: 'en' | 'th';
  onSaved: (alertKey: string, driverName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(overrideName);
  const [isPending, startTransition] = useTransition();
  const [hasError, setHasError] = useState(false);

  function startEditing() {
    setDraft(overrideName);
    setHasError(false);
    setIsEditing(true);
  }

  function save() {
    if (isPending) return;
    const driverName = draft.trim();
    if (driverName === overrideName.trim()) {
      setIsEditing(false);
      return;
    }
    setHasError(false);
    startTransition(async () => {
      try {
        const result = await saveAlertDriverName({ dashboardPublicId, alertKey, driverName });
        if (result.ok) {
          onSaved(alertKey, result.driverName);
          setIsEditing(false);
        } else {
          setHasError(true);
        }
      } catch {
        setHasError(true);
      }
    });
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          maxLength={128}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          placeholder={lang === 'th' ? 'ชื่อคนขับ' : 'Driver name'}
          className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {isPending ? '…' : lang === 'th' ? 'บันทึก' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          disabled={isPending}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        >
          ✕
        </button>
        {hasError && (
          <span className="text-xs text-red-500">
            {lang === 'th' ? 'บันทึกไม่สำเร็จ' : 'Failed'}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={lang === 'th' ? 'แก้ไขชื่อคนขับ' : 'Edit driver name'}
      className="group inline-flex items-center gap-1.5 text-xs"
    >
      {overrideName ? (
        <span className="font-medium text-zinc-900 dark:text-white">{overrideName}</span>
      ) : (
        <span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
          {lang === 'th' ? 'ระบุคนขับ' : 'Set driver'}
        </span>
      )}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-zinc-300 group-hover:text-red-500 dark:text-zinc-600"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    </button>
  );
}
