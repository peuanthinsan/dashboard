'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import type { SiteCopy } from 'app/site-i18n-copy';
import { inputBase, labelBase, btnPrimary, textMuted } from 'app/ui/design-tokens';

type LoginState = {
  error: string | null;
};

const initialState: LoginState = {
  error: null,
};

type LoginCopy = SiteCopy['login'];

function FormError({ message, id }: { message: string | null; id: string }) {
  const { pending } = useFormStatus();

  if (!message) {
    return null;
  }

  if (pending) {
    return null;
  }

  return (
    <p id={id} className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

function SubmitButton({ copy }: { copy: LoginCopy }) {
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
        copy.signIn
      )}
      {pending ? (
        <span className="sr-only" role="status">
          {copy.signingIn}
        </span>
      ) : null}
    </button>
  );
}

const LOGIN_ERROR_ID = 'login-form-error';
const LOGIN_PASSWORD_HINT_ID = 'login-password-hint';

function LoginFields({ state, copy }: { state: LoginState; copy: LoginCopy }) {
  const { pending } = useFormStatus();
  const associateError = Boolean(state.error) && !pending;

  const passwordDescribedBy = [associateError ? LOGIN_ERROR_ID : '', LOGIN_PASSWORD_HINT_ID]
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
          aria-describedby={associateError ? LOGIN_ERROR_ID : undefined}
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
          autoComplete="current-password"
          required
          aria-required="true"
          aria-invalid={associateError || undefined}
          aria-describedby={passwordDescribedBy}
          className={`mt-1.5 ${inputBase}`}
        />
        <p id={LOGIN_PASSWORD_HINT_ID} className={`mt-1.5 ${textMuted}`}>
          {copy.passwordHint}
        </p>
      </div>
      <FormError id={LOGIN_ERROR_ID} message={state.error} />
      <SubmitButton copy={copy} />
    </>
  );
}

export function LoginForm({
  action,
  copy,
}: {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  copy: LoginCopy;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <LoginFields state={state} copy={copy} />
    </form>
  );
}
