'use client';

import { PropsWithChildren } from 'react';
import { useFormState } from 'react-dom';
import { ActionState, initialActionState } from './types';

type AdminFormProps = PropsWithChildren<{
  action: (state: ActionState, payload: FormData) => Promise<ActionState>;
  className?: string;
  statusClassName?: string;
}>;

const statusStyles: Record<ActionState['status'], string> = {
  idle: '',
  success: 'text-emerald-300',
  error: 'text-rose-300',
};

export function AdminForm({ action, className, statusClassName, children }: AdminFormProps) {
  const [state, formAction] = useFormState(action, initialActionState);
  const statusClass = `${statusStyles[state.status]} ${statusClassName ?? ''}`.trim();

  return (
    <form action={formAction} className={className}>
      {children}
      {state.status !== 'idle' ? (
        <p role="status" aria-live="polite" className={statusClass}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
