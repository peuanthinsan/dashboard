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
      {/* Left panel — brand / hero */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-zinc-950 via-red-950/90 to-zinc-950 p-12 lg:flex">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 bottom-1/4 h-48 w-48 rounded-full bg-red-500/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 rounded-full bg-orange-500/5 blur-2xl" aria-hidden="true" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white">SongdeeGPS</h1>
          <p className="mt-1 text-sm font-medium text-red-400/80">
            Fleet Safety Intelligence — Bangkok
          </p>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Navigate. Conquer.
            <br />
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Command your fleet.
            </span>
          </h2>
          <div className="space-y-3 text-sm text-red-200/80">
            {[
              'Real-time driver safety alerts',
              'Fleet performance analytics',
              'Safety score tracking',
              'Exportable reports',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 text-sm text-red-400 ring-1 ring-red-500/20">
                  ⚓
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-zinc-500">
          © 2026 SongdeeGPS — กรุงเทพมหานคร
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
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
              className="font-medium text-red-600 transition-colors hover:text-red-500 dark:text-red-400"
            >
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
