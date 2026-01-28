import { AuthError } from 'next-auth';
import { z } from 'zod';

import { signIn } from 'app/auth';
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
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg)]">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-6 pt-8 text-center sm:px-16">
          <h3 className="text-xl font-semibold">Sign In</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Use your email and password to sign in
          </p>
        </div>
        <LoginForm action={login} />
      </div>
    </div>
  );
}
