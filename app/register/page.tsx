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
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--app-bg)]">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--app-border)] shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-6 pt-8 text-center sm:px-16">
          <h3 className="text-xl font-semibold">Sign Up</h3>
          <p className="text-sm text-[var(--app-text-subtle)]">
            Create an account with your email and password
          </p>
        </div>
        <RegisterForm action={register} />
      </div>
    </div>
  );
}
