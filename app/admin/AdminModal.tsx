'use client';

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from 'app/hooks/useFocusTrap';

type AdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  sizeClassName?: string;
};

export default function AdminModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  sizeClassName = 'max-w-3xl',
}: AdminModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const trapRef = useFocusTrap(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
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
        aria-describedby={description ? descriptionId : undefined}
        className={`relative w-full ${sizeClassName} max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-950/20 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40`}
      >
        <div className="relative border-b border-zinc-200 bg-zinc-50 px-5 py-4 pr-14 dark:border-zinc-800 dark:bg-zinc-800/50">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3.5 flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-950 focus:outline-none focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            aria-label={`Close ${title}`}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="max-h-[calc(90vh-6rem)] overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
