import type { LoginState } from './actions';

export function navigateAfterLogin(state: LoginState, navigate: (path: string) => void): void {
  if (state.success && state.error === null) navigate('/dashboard');
}

export async function recoverLoginAfterError(
  loadSession: () => Promise<{ user?: unknown } | null>,
  navigate: (path: string) => void,
): Promise<boolean> {
  try {
    const session = await loadSession();
    if (session?.user) {
      navigate('/dashboard');
      return true;
    }
  } catch {
    // Keep the retry UI when session verification is unavailable.
  }
  return false;
}
