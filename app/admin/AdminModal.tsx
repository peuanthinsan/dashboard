'use client';

import { useId } from 'react';
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
        className={`relative w-full ${sizeClassName} max-h-[90vh] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900`}
      >
        <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
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
