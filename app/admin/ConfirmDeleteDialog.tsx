'use client';

import { useId, useState } from 'react';

type DialogTitleProps = {
  id: string;
  children: React.ReactNode;
};

function DialogTitle({ id, children }: DialogTitleProps) {
  return (
    <h2 id={id} className="text-lg font-semibold text-zinc-900 dark:text-white">
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
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm dark:bg-zinc-950/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <p id={descriptionId} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
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
              'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 sm:w-auto'
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
