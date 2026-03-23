/**
 * In-memory rate limiting for auth flows.
 * Note: For production at scale, use Redis (e.g. Upstash) — this store does not persist across serverless instances.
 */

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const store = new Map<string, RateLimitEntry>();

export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
export const RATE_LIMIT_MAX_LOGIN = 5; // failed attempts only
export const RATE_LIMIT_MAX_REGISTER = 5;

/** Check if under limit; does not increment. Use for login before attempting. */
export function checkRateLimit(
  key: string,
  maxAttempts: number
): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.expiresAt <= now) {
    return { ok: true };
  }

  if (entry.count >= maxAttempts) {
    return {
      ok: false,
      message: 'Too many attempts. Please try again in a minute.',
    };
  }

  return { ok: true };
}

/** Record a failed attempt (e.g. failed login). Call only on failure. */
export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  entry.count += 1;
}

/** Check and increment in one call. Use for register (every attempt counts). */
export function checkAndIncrementRateLimit(
  key: string,
  maxAttempts: number
): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= maxAttempts) {
    return {
      ok: false,
      message: 'Too many attempts. Please try again in a minute.',
    };
  }

  entry.count += 1;
  return { ok: true };
}

export async function getClientIdentifier(
  headers: () => Promise<Headers>
): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim();
  return ip || h.get('x-real-ip') || 'unknown';
}
