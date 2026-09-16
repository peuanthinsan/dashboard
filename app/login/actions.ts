'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from 'app/auth';
import { getDashboardLang } from 'app/dashboard/i18n';
import { buildLoginSchema } from 'app/lib/site-auth-schemas';
import {
  checkRateLimit,
  getClientIdentifier,
  recordFailedAttempt,
  RATE_LIMIT_MAX_LOGIN,
} from 'app/lib/rate-limit';
import { getSiteCopy } from 'app/site-i18n-copy';

export type LoginState = {
  error: string | null;
  success: boolean;
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const copy = getSiteCopy(await getDashboardLang());
  const parsed = buildLoginSchema(copy.validation).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.login.invalidDetails, success: false };
  }

  const clientId = await getClientIdentifier(headers);
  if (!checkRateLimit(`login:${clientId}`, RATE_LIMIT_MAX_LOGIN).ok) {
    return { error: copy.rateLimitExceeded, success: false };
  }

  try {
    // Set the session cookie, then let the form perform a full document navigation.
    // This avoids reusing a pre-login client router tree after authentication.
    await signIn('credentials', {
      redirect: false,
      redirectTo: '/dashboard',
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        recordFailedAttempt(`login:${clientId}`);
        return { error: copy.login.invalidCredentials, success: false };
      }
      return { error: copy.login.unavailable, success: false };
    }
    throw error;
  }

  // Native form posts need an HTTP redirect when JavaScript has not hydrated.
  if (!(await headers()).has('next-action')) redirect('/dashboard');
  return { error: null, success: true };
}
