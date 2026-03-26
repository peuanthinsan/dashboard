'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import type { SiteCopy } from 'app/site-i18n-copy';
import { inputBase, labelBase, btnPrimary, textMuted } from 'app/ui/design-tokens';

type RegisterState = {
  error: string | null;
};

const initialState: RegisterState = {
  error: null,
};

type RegisterCopy = SiteCopy['register'];

function FormError({ message, id }: { message: string | null; id: string }) {
  const { pending } = useFormStatus();

  if (!message || pending) {
    return null;
  }

  return (
    <p id={id} className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

function SubmitButton({ copy }: { copy: RegisterCopy }) {
  const { pending } = useFormStatus();

  return (
    <button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending}
      className={`${btnPrimary} w-full py-2.5`}
    >
      {pending ? (
        <svg
          className="h-4 w-4 animate-spin text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        copy.createAccount
      )}
      {pending ? (
        <span className="sr-only" role="status">
          {copy.creatingAccount}
        </span>
      ) : null}
    </button>
  );
}

const REGISTER_ERROR_ID = 'register-form-error';
const REGISTER_PASSWORD_HINT_ID = 'register-password-hint';

function RegisterFields({ state, copy }: { state: RegisterState; copy: RegisterCopy }) {
  const { pending } = useFormStatus();
  const associateError = Boolean(state.error) && !pending;

  const passwordDescribedBy = [associateError ? REGISTER_ERROR_ID : '', REGISTER_PASSWORD_HINT_ID]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div>
        <label htmlFor="email" className={labelBase}>
          {copy.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          inputMode="email"
          required
          aria-required="true"
          aria-invalid={associateError || undefined}
          aria-describedby={associateError ? REGISTER_ERROR_ID : undefined}
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelBase}>
          {copy.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-required="true"
          aria-invalid={associateError || undefined}
          aria-describedby={passwordDescribedBy}
          className={`mt-1.5 ${inputBase}`}
        />
        <p id={REGISTER_PASSWORD_HINT_ID} className={`mt-1.5 ${textMuted}`}>
          {copy.passwordHint}
        </p>
      </div>
      <FormError id={REGISTER_ERROR_ID} message={state.error} />
      <SubmitButton copy={copy} />
    </>
  );
}

export function RegisterForm({
  action,
  copy,
}: {
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
  copy: RegisterCopy;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <RegisterFields state={state} copy={copy} />
    </form>
  );
}
