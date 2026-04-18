'use client';

import { useId, useState } from 'react';
import { useFocusTrap } from 'app/hooks/useFocusTrap';

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
  isOpen: boolean;
  dialogId: string;
};

function DialogContent({
  title,
  description,
  children,
  onClose,
  isOpen,
  dialogId,
}: DialogContentProps) {
  const titleId = useId();
  const descriptionId = useId();
  const trapRef = useFocusTrap(isOpen, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      {/* Click-catcher only — not focusable so focus moves into the dialog (focus trap). */}
      <div
        role="presentation"
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm dark:bg-zinc-950/70"
        onClick={onClose}
      />
      <div
        ref={trapRef}
        id={dialogId}
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
  /** Name of the outer form's intent field; the confirm button dispatches a submit
   * with this hidden input set to `intent=delete` so the parent server action sees it. */
  formId?: string;
};

export default function ConfirmDeleteDialog({
  title = 'Delete item',
  description = 'This action cannot be undone. Are you sure you want to continue?',
  triggerClassName,
  confirmClassName,
  cancelClassName,
  confirmLabel = 'Delete',
  triggerLabel = 'Delete',
  formId,
}: ConfirmDeleteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogId = useId();

  const handleConfirm = () => {
    // Find the nearest <form> that contains this trigger button. Because the dialog
    // is rendered in a fixed-position overlay (outside the form DOM tree), a plain
    // `type="submit"` would either do nothing or submit the wrong form depending
    // on React reconciliation. Instead we imperatively submit the form the trigger
    // lives inside, injecting `intent=delete` first.
    const trigger = document.getElementById(dialogId + '-trigger');
    const form = formId
      ? (document.getElementById(formId) as HTMLFormElement | null)
      : (trigger?.closest('form') ?? null);
    if (!form) {
      setIsOpen(false);
      return;
    }
    let intentInput = form.querySelector<HTMLInputElement>('input[name="intent"][data-confirm-dialog="1"]');
    if (!intentInput) {
      intentInput = document.createElement('input');
      intentInput.type = 'hidden';
      intentInput.name = 'intent';
      intentInput.dataset.confirmDialog = '1';
      form.appendChild(intentInput);
    }
    intentInput.value = 'delete';
    setIsOpen(false);
    // requestSubmit preserves validation and the submit event lifecycle (vs .submit()).
    form.requestSubmit();
  };

  return (
    <>
      <button
        id={dialogId + '-trigger'}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>
      {isOpen ? (
        <DialogContent
          dialogId={dialogId}
          title={title}
          description={description}
          onClose={() => setIsOpen(false)}
          isOpen={isOpen}
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
          <button type="button" onClick={handleConfirm} className={confirmClassName}>
            {confirmLabel}
          </button>
        </DialogContent>
      ) : null}
    </>
  );
}
