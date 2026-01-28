'use client';

import { useId, useState } from 'react';

type DialogTitleProps = {
  id: string;
  children: React.ReactNode;
};

function DialogTitle({ id, children }: DialogTitleProps) {
  return (
    <h2 id={id} className="text-lg font-semibold text-[var(--app-text)]">
      {children}
    </h2>
  );
}

type DialogContentProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
};

function DialogContent({
  title,
  description,
  children,
  onClose,
}: DialogContentProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--app-overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl"
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <p id={descriptionId} className="mt-2 text-sm text-[var(--app-text-muted)]">
          {description}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}

type ConfirmDeleteDialogProps = {
  title?: string;
  description?: string;
  triggerClassName?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  confirmLabel?: string;
  triggerLabel?: string;
};

export default function ConfirmDeleteDialog({
  title = 'Delete item',
  description = 'This action cannot be undone. Are you sure you want to continue?',
  triggerClassName,
  confirmClassName,
  cancelClassName,
  confirmLabel = 'Delete',
  triggerLabel = 'Delete',
}: ConfirmDeleteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>
      {isOpen ? (
        <DialogContent
          title={title}
          description={description}
          onClose={() => setIsOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className={
              cancelClassName ??
              'w-full rounded-lg border border-[var(--app-border-strong)] px-3 py-2 text-sm text-[var(--app-text)] hover:border-[var(--app-border-strong)] sm:w-auto'
            }
          >
            Cancel
          </button>
          <button
            type="submit"
            name="intent"
            value="delete"
            className={confirmClassName}
          >
            {confirmLabel}
          </button>
        </DialogContent>
      ) : null}
    </>
  );
}
