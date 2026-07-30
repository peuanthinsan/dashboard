'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  EMPTY_DATE_TIME_RANGE,
  isCompleteDateTimeRange,
  type DateTimeRange,
} from 'app/dashboards/dateTimeRange';
import { useFocusTrap } from 'app/hooks/useFocusTrap';

/** Computed screen position for the portaled popover, derived from the trigger's
 * bounding rect. Values are viewport-relative (used with `position: fixed`), so no
 * scroll offset is added — `getBoundingClientRect()` already reflects the trigger's
 * current on-screen position, and the position is recomputed on scroll/resize. */
type PopoverAnchor = {
  top: number;
  left: number;
  width: number;
};

type DateTimeRangePickerProps = {
  value: DateTimeRange;
  onChange: (value: DateTimeRange) => void;
  lang?: string;
  className?: string;
};

type CalendarPanelProps = {
  title: string;
  value: string;
  range: DateTimeRange;
  cursor: Date;
  onCursorChange: (date: Date) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  locale: string;
  previousLabel: string;
  nextLabel: string;
  timeLabel: string;
  defaultTime: string;
};

const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function datePart(value: string): string {
  return value.split('T')[0] ?? '';
}

function timePart(value: string, fallback: string): string {
  return value.split('T')[1]?.slice(0, 5) || fallback;
}

function utcDateFromDatePart(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function monthCursor(value: string, fallback = new Date()): Date {
  const parsed = utcDateFromDatePart(datePart(value));
  return parsed
    ? new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
    : new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
}

function formatButtonLabel(range: DateTimeRange, locale: string): string {
  const start = utcDateFromDatePart(datePart(range.start));
  const end = utcDateFromDatePart(datePart(range.end));
  if (!start || !end) return '';
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: start.getUTCFullYear() === end.getUTCFullYear() ? undefined : 'numeric',
    timeZone: 'UTC',
  });
  const endFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${dateFormatter.format(start)}, ${timePart(range.start, '00:00')} – ${endFormatter.format(end)}, ${timePart(range.end, '23:59')}`;
}

function CalendarPanel({
  title,
  value,
  range,
  cursor,
  onCursorChange,
  onDateChange,
  onTimeChange,
  locale,
  previousLabel,
  nextLabel,
  timeLabel,
  defaultTime,
}: CalendarPanelProps) {
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const selectedDate = datePart(value);
  const startDate = datePart(range.start);
  const endDate = datePart(range.end);
  const weekdays = locale === 'th-TH' ? WEEKDAYS_TH : WEEKDAYS_EN;
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(cursor).toUpperCase();
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const moveMonth = (amount: number) => {
    onCursorChange(new Date(Date.UTC(year, month + amount, 1)));
  };

  return (
    <section className="min-w-0 flex-1" aria-label={title}>
      <h3 className="mb-3 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-md bg-zinc-50 px-2.5 py-1.5 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {monthLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label={previousLabel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label={nextLabel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-zinc-200 pb-1 dark:border-zinc-700">
        {weekdays.map((weekday, index) => (
          <span
            key={`${weekday}-${index}`}
            className="py-1 text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500"
          >
            {weekday}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`blank-${index}`} className="h-8" aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const isSelected = key === selectedDate;
          const inRange = Boolean(startDate && endDate && key >= startDate && key <= endDate);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDateChange(key)}
              aria-label={fullDateFormatter.format(new Date(Date.UTC(year, month, day)))}
              aria-pressed={isSelected}
              className={[
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums transition',
                isSelected
                  ? 'bg-red-600 font-semibold text-white shadow-sm ring-2 ring-red-200 dark:ring-red-900'
                  : inRange
                    ? 'bg-red-50 font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>{timeLabel}</span>
        <input
          type="time"
          step={60}
          value={timePart(value, defaultTime)}
          onChange={(event) => onTimeChange(event.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-zinc-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-red-500 dark:focus:ring-red-950"
        />
      </label>
    </section>
  );
}

export default function DateTimeRangePicker({
  value,
  onChange,
  lang = 'en',
  className = '',
}: DateTimeRangePickerProps) {
  const isThai = lang === 'th';
  const locale = isThai ? 'th-TH' : 'en-GB';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateTimeRange>(value);
  const [startCursor, setStartCursor] = useState(() => monthCursor(value.start));
  const [endCursor, setEndCursor] = useState(() => {
    const startFallback = monthCursor(value.start);
    startFallback.setUTCMonth(startFallback.getUTCMonth() + 1);
    return monthCursor(value.end, startFallback);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const dialogId = useId();
  const invalidMessageId = useId();
  const closePicker = useCallback(() => {
    setOpen(false);
    setDraft(value);
  }, [value]);
  const dialogRef = useFocusTrap(open, closePicker);

  // The popover is portaled to document.body (see the render below) so its stacking
  // context is no longer trapped inside the filter section's backdrop-blur stacking
  // context. Because it's no longer a DOM descendant of rootRef, it must be positioned
  // manually from the trigger's on-screen rect instead of relying on `position: absolute`.
  const computeAnchor = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rootFontSize =
      parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = rootFontSize * 0.5; // 0.5rem gap below the trigger, matching the previous CSS.
    const margin = rootFontSize * 1; // 1rem viewport margin, matching the previous `calc(100vw-2rem)` allowance.
    const maxWidth = Math.min(rootFontSize * 42, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(rect.left, margin),
      window.innerWidth - margin - maxWidth
    );
    setAnchor({ top: rect.bottom + gap, left, width: maxWidth });
  }, []);

  // Recompute the anchor as soon as the popover opens, before paint, so it never
  // flashes at a stale position.
  useLayoutEffect(() => {
    if (!open) return;
    // Synchronizing popover position from the trigger's DOM rect (an external system)
    // before first paint; there is no non-effect way to read layout for a portaled
    // element.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    computeAnchor();
  }, [computeAnchor, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // The dialog is portaled to document.body, so it's no longer a descendant of
      // rootRef — an outside click must miss both the trigger AND the portaled dialog.
      if (rootRef.current?.contains(target)) return;
      if (dialogRef.current?.contains(target)) return;
      closePicker();
    };
    const onViewportChange = () => computeAnchor();
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onViewportChange);
    // Capture phase: scroll events don't bubble, so a listener on `window` in the
    // default (bubble) phase only ever sees the document itself scrolling. Capture
    // phase also observes scroll on any nested `overflow-auto` ancestor of the trigger.
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [closePicker, computeAnchor, dialogRef, open]);

  const label = useMemo(() => formatButtonLabel(value, locale), [locale, value]);
  const validDraft = isCompleteDateTimeRange(draft);

  const openPicker = () => {
    if (open) {
      closePicker();
      return;
    }
    setDraft(value);
    setStartCursor(monthCursor(value.start));
    const fallback = monthCursor(value.start);
    fallback.setUTCMonth(fallback.getUTCMonth() + 1);
    setEndCursor(monthCursor(value.end, fallback));
    setOpen(true);
  };

  const setDraftDate = (side: 'start' | 'end', date: string) => {
    setDraft((current) => ({
      ...current,
      [side]: `${date}T${timePart(current[side], side === 'start' ? '00:00' : '23:59')}`,
    }));
  };

  const setDraftTime = (side: 'start' | 'end', time: string) => {
    const fallbackDate =
      datePart(draft[side]) ||
      datePart(side === 'start' ? draft.end : draft.start) ||
      `${(side === 'start' ? startCursor : endCursor).getUTCFullYear()}-${pad((side === 'start' ? startCursor : endCursor).getUTCMonth() + 1)}-01`;
    setDraft((current) => ({ ...current, [side]: `${fallbackDate}T${time}` }));
  };

  const copy = {
    select: isThai ? 'เลือกช่วงวันที่และเวลา' : 'Select date & time range',
    start: isThai ? 'วันที่เริ่มต้น' : 'Start Date',
    end: isThai ? 'วันที่สิ้นสุด' : 'End Date',
    previous: isThai ? 'เดือนก่อนหน้า' : 'Previous month',
    next: isThai ? 'เดือนถัดไป' : 'Next month',
    time: isThai ? 'เวลา' : 'Time',
    clear: isThai ? 'ล้าง' : 'Clear',
    cancel: isThai ? 'ยกเลิก' : 'Cancel',
    apply: isThai ? 'ใช้' : 'Apply',
    invalid: isThai ? 'เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น' : 'End must be after start',
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="inline-flex max-w-full items-center rounded-lg border border-zinc-200/70 bg-white/90 shadow-card dark:border-zinc-700/70 dark:bg-zinc-900/90">
        <button
          type="button"
          onClick={openPicker}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          className="flex min-h-9 min-w-0 items-center gap-2 rounded-l-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v3m8-3v3M3.5 9.5h17M5.5 4h13a2 2 0 012 2v13a2 2 0 01-2 2h-13a2 2 0 01-2-2V6a2 2 0 012-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
          </svg>
          <span className={label ? 'truncate' : 'text-zinc-400 dark:text-zinc-500'}>
            {label || copy.select}
          </span>
          <svg className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
          </svg>
        </button>
        {label ? (
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_DATE_TIME_RANGE);
              onChange(EMPTY_DATE_TIME_RANGE);
              setOpen(false);
            }}
            aria-label={copy.clear}
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ×
          </button>
        ) : null}
      </div>

      {open
        ? createPortal(
            <div
              ref={dialogRef}
              id={dialogId}
              role="dialog"
              aria-modal="true"
              aria-label={copy.select}
              aria-describedby={
                !validDraft && (draft.start || draft.end) ? invalidMessageId : undefined
              }
              // Below `sm:`, the mobile inset styling (fixed inset-x-3 bottom-3 top-3)
              // is unchanged. At `sm:` and up, top/left/width come from the anchor state
              // computed against the trigger's on-screen rect — passed as CSS custom
              // properties so they only take effect once the `sm:` media query matches,
              // and never fight the mobile inset classes at small viewports.
              style={
                anchor
                  ? ({
                      '--picker-top': `${anchor.top}px`,
                      '--picker-left': `${anchor.left}px`,
                      '--picker-width': `${anchor.width}px`,
                    } as CSSProperties)
                  : undefined
              }
              className="fixed inset-x-3 bottom-3 top-3 z-50 overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:bottom-auto sm:left-[var(--picker-left)] sm:right-auto sm:top-[var(--picker-top)] sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-[var(--picker-width)] sm:p-5"
            >
              <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-700">
                <CalendarPanel
                  title={copy.start}
                  value={draft.start}
                  range={draft}
                  cursor={startCursor}
                  onCursorChange={setStartCursor}
                  onDateChange={(date) => setDraftDate('start', date)}
                  onTimeChange={(time) => setDraftTime('start', time)}
                  locale={locale}
                  previousLabel={copy.previous}
                  nextLabel={copy.next}
                  timeLabel={copy.time}
                  defaultTime="00:00"
                />
                <div className="sm:pl-6">
                  <CalendarPanel
                    title={copy.end}
                    value={draft.end}
                    range={draft}
                    cursor={endCursor}
                    onCursorChange={setEndCursor}
                    onDateChange={(date) => setDraftDate('end', date)}
                    onTimeChange={(time) => setDraftTime('end', time)}
                    locale={locale}
                    previousLabel={copy.previous}
                    nextLabel={copy.next}
                    timeLabel={copy.time}
                    defaultTime="23:59"
                  />
                </div>
              </div>
              {!validDraft && (draft.start || draft.end) ? (
                <p
                  id={invalidMessageId}
                  className="mt-3 text-xs font-medium text-red-600 dark:text-red-400"
                >
                  {copy.invalid}
                </p>
              ) : null}
              <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between border-t border-zinc-200 bg-white px-4 pb-1 pt-4 dark:border-zinc-700 dark:bg-zinc-900 sm:-mx-5 sm:px-5">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(EMPTY_DATE_TIME_RANGE);
                    onChange(EMPTY_DATE_TIME_RANGE);
                    setOpen(false);
                  }}
                  className="px-2 py-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {copy.clear}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(value);
                      setOpen(false);
                    }}
                    className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={!validDraft}
                    onClick={() => {
                      if (!validDraft) return;
                      onChange(draft);
                      setOpen(false);
                    }}
                    className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.apply}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
