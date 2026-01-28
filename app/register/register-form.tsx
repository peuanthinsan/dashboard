'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';

import { Form } from 'app/form';
import { SubmitButton } from 'app/submit-button';

type RegisterState = {
  error: string | null;
};

const initialState: RegisterState = {
  error: null,
};

function FormError({ message }: { message: string | null }) {
  const { pending } = useFormStatus();

  if (!message || pending) {
    return null;
  }

  return (
    <p className="text-center text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

export function RegisterForm({
  action,
}: {
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <Form action={formAction}>
      <SubmitButton>Sign Up</SubmitButton>
      <FormError message={state.error} />
      <p className="text-center text-sm text-[var(--app-text-subtle)]">
        {'Already have an account? '}
        <Link href="/login" className="font-semibold text-[var(--app-text)]">
          Sign in
        </Link>
        {' instead.'}
      </p>
    </Form>
  );
}
