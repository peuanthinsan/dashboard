'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

import type { SiteCopy } from 'app/site-i18n-copy';
import { inputBase, labelBase, btnPrimary, btnSecondary, btnSmall, textMuted } from 'app/ui/design-tokens';

type ChangePasswordState = {
  error: string | null;
  success: boolean;
};

const initialState: ChangePasswordState = {
  error: null,
  success: false,
};

type ChangePasswordCopy = SiteCopy['changePassword'];

function FormError({ message, id }: { message: string | null; id: string }) {
  const { pending } = useFormStatus();
  if (!message || pending) return null;
  return (
    <p id={id} className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

function SubmitButton({ copy }: { copy: ChangePasswordCopy }) {
  const { pending } = useFormStatus();
  return (
    <button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending}
      className={`${btnPrimary} w-full py-2.5`}
    >
      {pending ? (
        <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        copy.submit
      )}
      {pending ? (
        <span className="sr-only" role="status">
          {copy.updating}
        </span>
      ) : null}
    </button>
  );
}

const CHANGE_PWD_ERROR_ID = 'change-password-form-error';
const NEW_PWD_HINT_ID = 'change-password-new-hint';

function ChangePasswordFields({
  state,
  copy,
}: {
  state: ChangePasswordState;
  copy: ChangePasswordCopy;
}) {
  const { pending } = useFormStatus();
  const associateError = Boolean(state.error) && !pending;

  const newPasswordDescribedBy = [associateError ? CHANGE_PWD_ERROR_ID : '', NEW_PWD_HINT_ID]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div>
        <label htmlFor="currentPassword" className={labelBase}>
          {copy.currentLabel}
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          aria-required="true"
          aria-invalid={associateError || undefined}
          aria-describedby={associateError ? CHANGE_PWD_ERROR_ID : undefined}
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor="newPassword" className={labelBase}>
          {copy.newLabel}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          aria-required="true"
          aria-invalid={associateError || undefined}
          aria-describedby={newPasswordDescribedBy}
          className={`mt-1.5 ${inputBase}`}
        />
        <p id={NEW_PWD_HINT_ID} className={`mt-1.5 ${textMuted}`}>
          {copy.hint}
        </p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelBase}>
          {copy.confirmLabel}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
          aria-required="true"
          aria-invalid={associateError || undefined}
          aria-describedby={associateError ? CHANGE_PWD_ERROR_ID : undefined}
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <FormError id={CHANGE_PWD_ERROR_ID} message={state.error} />
      <SubmitButton copy={copy} />
      <div className="text-center">
        <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          {copy.backLink}
        </Link>
      </div>
    </>
  );
}

export function ChangePasswordForm({
  action,
  copy,
}: {
  action: (state: ChangePasswordState, formData: FormData) => Promise<ChangePasswordState>;
  copy: ChangePasswordCopy;
}) {
  const [state, formAction] = useActionState(action, initialState);

  if (state.success) {
    return (
      <div
        className="space-y-4 text-center"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <svg
            className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{copy.success}</p>
        <Link href="/dashboard" className={`${btnSecondary} ${btnSmall} inline-flex`}>
          {copy.backLink}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <ChangePasswordFields state={state} copy={copy} />
    </form>
  );
}
