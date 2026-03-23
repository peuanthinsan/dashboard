import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { z } from 'zod';

import { signIn } from 'app/auth';
import {
  checkRateLimit,
  getClientIdentifier,
  recordFailedAttempt,
  RATE_LIMIT_MAX_LOGIN,
} from 'app/lib/rate-limit';
import { LoginForm } from 'app/login/login-form';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import ThemeToggle from 'app/theme/ThemeToggle';

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

    const clientId = await getClientIdentifier(headers);
    const rateLimitResult = checkRateLimit(
      `login:${clientId}`,
      RATE_LIMIT_MAX_LOGIN
    );
    if (!rateLimitResult.ok) {
      return { error: rateLimitResult.message };
    }

    try {
      await signIn('credentials', {
        redirectTo: '/dashboard',
        email: parsed.data.email,
        password: parsed.data.password,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        recordFailedAttempt(`login:${clientId}`);
        return { error: 'Invalid email or password.' };
      }
      throw error;
    }

    return { error: null };
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — SongdeeGPS brand identity */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-12 lg:flex">
        {/* Brand GPS pin pattern */}
        <div className="pointer-events-none absolute inset-0 brand-pattern opacity-50" />
        {/* Red edge accent */}
        <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-red-500/30 to-transparent" />

        {/* Large GPS pin watermark */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]" aria-hidden="true">
          <svg width="400" height="520" viewBox="0 0 40 52" fill="currentColor" className="text-red-400">
            <path d="M20 0C8.95 0 0 8.95 0 20c0 14.25 20 32 20 32s20-17.75 20-32C40 8.95 31.05 0 20 0z" />
          </svg>
        </div>

        {/* Decorative glow */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-red-600/8 blur-3xl" aria-hidden="true" />

        <div className="relative">
          <div className="inline-block rounded-xl bg-white/95 p-3 shadow-lg">
            <SongdeeLogo height={44} />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-400">
            Fleet Safety Intelligence
          </p>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            ส่งดีจีพีเอส
            <br />
            <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Command your fleet.
            </span>
          </h2>
          <div className="space-y-3 text-sm text-zinc-400">
            {[
              { icon: '📍', text: 'Real-time GPS fleet tracking' },
              { icon: '🛡️', text: 'AI-powered driver safety alerts' },
              { icon: '📊', text: 'Safety score tracking & compliance' },
              { icon: '📋', text: 'Exportable reports & insights' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-sm ring-1 ring-red-500/15">
                  {icon}
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-zinc-600">
            © 2026 SongdeeGPS — ส่งดีจีพีเอส
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="absolute right-4 top-4 z-10">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 text-center lg:text-left">
            {/* Mobile brand — visible only on small screens */}
            <div className="mb-4 flex items-center justify-center gap-2.5 lg:hidden">
              <SongdeeLogo height={28} />
            </div>
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
