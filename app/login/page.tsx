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
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-zinc-900 via-red-950 to-zinc-900 p-12 lg:flex">
        <div>
          <h1 className="text-2xl font-bold text-white">SongdeeGPS</h1>
          <p className="mt-1 text-sm text-red-300">
            Fleet Safety Intelligence — Bangkok
          </p>
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Navigate. Conquer.
            <br />
            Command your fleet.
          </h2>
          <div className="space-y-3 text-sm text-red-200">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/30 text-red-300">
                ⚓
              </span>
              Real-time driver safety alerts
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/30 text-red-300">
                ⚓
              </span>
              Fleet performance analytics
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/30 text-red-300">
                ⚓
              </span>
              Safety score tracking
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/30 text-red-300">
                ⚓
              </span>
              Exportable reports
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          © 2026 SongdeeGPS — กรุงเทพมหานคร
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to your account to continue
            </p>
          </div>
          <LoginForm action={login} />
          <p className="mt-6 text-center text-xs text-zinc-400">
            Don&apos;t have an account?{' '}
            <a
              href="/register"
              className="text-red-600 hover:text-red-500 dark:text-red-400"
            >
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
