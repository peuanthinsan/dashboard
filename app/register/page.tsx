import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

import { createUser, getUser } from 'app/db';
import { RegisterForm } from 'app/register/register-form';

const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .email('Enter a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters long.')
    .max(72, 'Password must be at most 72 characters long.'),
});

type RegisterState = {
  error: string | null;
};

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIdentifier() {
  const forwardedFor = headers().get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim();

  return ip || headers().get('x-real-ip') || 'unknown';
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    rateLimitStore.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many sign up attempts. Please try again shortly.' };
  }

  entry.count += 1;
  return { ok: true };
}

export default function Login() {
  async function register(
    _prevState: RegisterState,
    formData: FormData,
  ): Promise<RegisterState> {
    'use server';
    const email = formData.get('email');
    const password = formData.get('password');
    const parsed = registerSchema.safeParse({ email, password });

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message;
      return { error: firstError ?? 'Invalid registration details.' };
    }

    const rateLimitKey = getClientIdentifier();
    const rateLimitResult = checkRateLimit(rateLimitKey);

    if (!rateLimitResult.ok) {
      return { error: rateLimitResult.message ?? 'Too many sign up attempts.' };
    }

    const user = await getUser(parsed.data.email);

    if (user.length > 0) {
      return { error: 'An account with this email already exists.' };
    }

    await createUser(parsed.data.email, parsed.data.password);
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-red-600 via-red-700 to-violet-800 p-12 lg:flex">
        <div>
          <h1 className="text-2xl font-bold text-white">SongdeeGPS</h1>
          <p className="mt-1 text-sm text-red-200">
            Fleet Safety Intelligence
          </p>
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Monitor. Analyze.
            <br />
            Protect your fleet.
          </h2>
          <div className="space-y-3 text-sm text-red-200">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                ✓
              </span>
              Real-time driver safety alerts
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                ✓
              </span>
              Fleet performance analytics
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                ✓
              </span>
              Safety score tracking
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                ✓
              </span>
              Exportable reports
            </div>
          </div>
        </div>
        <p className="text-xs text-red-300">
          © 2026 SongdeeGPS. All rights reserved.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Create account
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Sign up to get started with SongdeeGPS
            </p>
          </div>
          <RegisterForm action={register} />
          <p className="mt-6 text-center text-xs text-zinc-400">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-red-600 hover:text-red-500 dark:text-red-400"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
