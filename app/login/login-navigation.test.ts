import { describe, expect, it, vi } from 'vitest';
import { navigateAfterLogin, recoverLoginAfterError } from './login-navigation';

describe('login document navigation', () => {
  it('navigates only after confirmed success to the fixed dashboard path', () => {
    const navigate = vi.fn();
    navigateAfterLogin({ error: null, success: false }, navigate);
    expect(navigate).not.toHaveBeenCalled();
    navigateAfterLogin({ error: null, success: true }, navigate);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });
  it('does not navigate when the state contains a login error', () => {
    const navigate = vi.fn();
    navigateAfterLogin({ error: 'Invalid credentials', success: false }, navigate);
    navigateAfterLogin({ error: 'Error', success: true }, navigate);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('recovers a lost action response only after the server confirms an existing session', async () => {
    let finish!: (session: { user: unknown }) => void;
    const loadSession = vi.fn(() => new Promise<{ user: unknown }>(resolve => { finish = resolve; }));
    const navigate = vi.fn();
    const pending = recoverLoginAfterError(loadSession, navigate);
    expect(navigate).not.toHaveBeenCalled();
    finish({ user: { id: 'diagnostic-user' } });
    expect(await pending).toBe(true);
    expect(loadSession).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });
  it.each([null, {}, { user: null }])('keeps the retry UI without an authenticated session: %j', async session => {
    const navigate = vi.fn();
    expect(await recoverLoginAfterError(async () => session, navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('keeps the retry UI when the session request fails', async () => {
    const navigate = vi.fn();
    expect(await recoverLoginAfterError(vi.fn().mockRejectedValue(new Error('offline')), navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
