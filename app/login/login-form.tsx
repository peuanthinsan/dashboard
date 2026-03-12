'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { inputBase, labelBase, btnPrimary } from 'app/ui/design-tokens';

type LoginState = {
  error: string | null;
};

const initialState: LoginState = {
  error: null,
};

function FormError({ message }: { message: string | null }) {
  const { pending } = useFormStatus();

  if (!message || pending) {
    return null;
  }

  return (
    <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

function SubmitButton() {
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
        'Sign in'
      )}
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Loading' : 'Submit form'}
      </span>
    </button>
  );
}

export function LoginForm({
  action,
}: {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelBase}>
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelBase}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton />
    </form>
  );
}
