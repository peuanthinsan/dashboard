import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, CredentialsSignin } from 'next-auth';
import { getSiteCopy } from 'app/site-i18n-copy';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(), checkRateLimit: vi.fn(), recordFailedAttempt: vi.fn(), headers: vi.fn(), redirect: vi.fn(),
}));
vi.mock('app/auth', () => ({ signIn: mocks.signIn }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next-auth', async () => {
  const { AuthError, CredentialsSignin } = await import('@auth/core/errors');
  return { AuthError, CredentialsSignin };
});
vi.mock('app/dashboard/i18n', () => ({ getDashboardLang: async () => 'en' }));
vi.mock('app/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordFailedAttempt: mocks.recordFailedAttempt,
  getClientIdentifier: async () => 'diagnostic-client',
  RATE_LIMIT_MAX_LOGIN: 5,
}));

import { login } from './actions';
const initial = { error: null, success: false };
const copy = getSiteCopy('en');
function credentials(email = 'test@example.invalid') {
  const data = new FormData();
  data.set('email', email);
  data.set('password', 'test-password-only');
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkRateLimit.mockReturnValue({ ok: true });
  mocks.headers.mockResolvedValue(new Headers({ 'Next-Action': 'diagnostic-action-id' }));
  mocks.redirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT'); });
  mocks.signIn.mockResolvedValue('https://dashboard.songdeegps.com/dashboard');
});
describe('login server action', () => {
  it('confirms a successful session without a framework redirect', async () => {
    expect(await login(initial, credentials())).toEqual({ error: null, success: true });
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith('credentials', {
      email: 'test@example.invalid', password: 'test-password-only',
      redirect: false, redirectTo: '/dashboard',
    });
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled();
  });
  it('preserves the server redirect for native form submission before hydration', async () => {
    mocks.headers.mockResolvedValue(new Headers());
    await expect(login(initial, credentials())).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.signIn).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith('/dashboard');
    expect(mocks.redirect.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.signIn.mock.invocationCallOrder[0]);
  });
  it('does not report success before authentication completes', async () => {
    let finish!: (value: string) => void;
    mocks.signIn.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
    let completed = false;
    const pending = login(initial, credentials()).then(result => { completed = true; return result; });
    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    finish('/dashboard');
    expect(await pending).toEqual({ error: null, success: true });
  });
  it('counts wrong credentials and keeps their existing message', async () => {
    mocks.signIn.mockRejectedValue(new CredentialsSignin());
    expect(await login(initial, credentials())).toEqual({ error: copy.login.invalidCredentials, success: false });
    expect(mocks.recordFailedAttempt).toHaveBeenCalledExactlyOnceWith('login:diagnostic-client');
  });
  it('does not label service errors as bad credentials or consume password retries', async () => {
    mocks.signIn.mockRejectedValue(new AuthError('upstream unavailable'));
    expect(await login(initial, credentials())).toEqual({ error: copy.login.unavailable, success: false });
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled();
  });
  it('enforces rate limiting before authentication', async () => {
    mocks.checkRateLimit.mockReturnValue({ ok: false });
    expect(await login(initial, credentials())).toEqual({ error: copy.rateLimitExceeded, success: false });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('rejects malformed input before authentication', async () => {
    expect((await login(initial, credentials('invalid'))).success).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('preserves unexpected errors for server logging and form transport handling', async () => {
    const error = new Error('unexpected');
    mocks.signIn.mockRejectedValue(error);
    await expect(login(initial, credentials())).rejects.toBe(error);
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled();
  });
});
