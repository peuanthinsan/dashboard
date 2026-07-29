'use client';

import { useId } from 'react';
import { useFocusTrap } from 'app/hooks/useFocusTrap';

type Props = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
};

/**
 * Imperative confirmation dialog — unlike ConfirmDeleteDialog (which submits
 * a form), this calls an `onConfirm` callback. Use it for JS-initiated bulk
 * actions that aren't part of a <form action={...}> server-action flow.
 */
export default function ConfirmActionDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmClassName,
  onConfirm,
  onClose,
  destructive = false,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const trapRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  const defaultConfirm = destructive
    ? 'rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 sm:w-auto'
    : 'rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div
        role="presentation"
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm dark:bg-zinc-950/70"
        onClick={onClose}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={confirmClassName ?? defaultConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
