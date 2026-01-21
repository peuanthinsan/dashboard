'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Form } from 'app/form';
import { SubmitButton } from 'app/submit-button';

type RegisterState = {
  error: string | null;
};

const initialState: RegisterState = {
  error: null,
};

export function RegisterForm({
  action,
}: {
  action: (prevState: RegisterState, formData: FormData) => Promise<RegisterState>;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <Form action={formAction}>
      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
          aria-live="polite"
        >
          {state.error}
        </p>
      ) : null}
      <SubmitButton>Sign Up</SubmitButton>
      <p className="text-center text-sm text-gray-600">
        {'Already have an account? '}
        <Link href="/login" className="font-semibold text-gray-800">
          Sign in
        </Link>
        {' instead.'}
      </p>
    </Form>
  );
}
