import { AuthError } from 'next-auth';
import { z } from 'zod';

import { signIn } from 'app/auth';
import { AuthShell } from 'app/auth/AuthShell';
import { LoginForm } from 'app/login/login-form';

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .email('Enter a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters long.')
    .max(72, 'Password must be at most 72 characters long.'),
});

type LoginState = {
  error: string | null;
};

export default function Login() {
  async function login(
    _prevState: LoginState,
    formData: FormData,
  ): Promise<LoginState> {
    'use server';
    const email = formData.get('email');
    const password = formData.get('password');
    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message;
      return { error: firstError ?? 'Invalid login details.' };
    }

    try {
      await signIn('credentials', {
        redirectTo: '/dashboard',
        email: parsed.data.email,
        password: parsed.data.password,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return { error: 'Invalid email or password.' };
      }
      throw error;
    }

    return { error: null };
  }

  return (
    <AuthShell title="Sign In" subtitle="Use your email and password to sign in">
      <LoginForm action={login} />
    </AuthShell>
  );
}
