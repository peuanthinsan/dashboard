'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';

import { Form } from 'app/form';
import { SubmitButton } from 'app/submit-button';

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
    <p className="text-center text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

export function LoginForm({
  action,
}: {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <Form action={formAction}>
      <SubmitButton>Sign in</SubmitButton>
      <FormError message={state.error} />
      <p className="text-center text-sm text-[var(--app-text-subtle)]">
        {"Don't have an account? "}
        <Link href="/register" className="font-semibold text-[var(--app-text)]">
          Sign up
        </Link>
        {' for free.'}
      </p>
    </Form>
  );
}
