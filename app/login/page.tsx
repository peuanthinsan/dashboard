import type { Metadata } from 'next';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import Link from 'next/link';

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
import LanguageToggle from 'app/dashboard/LanguageToggle';
import { getDashboardLang } from 'app/dashboard/i18n';
import { buildLoginSchema } from 'app/lib/site-auth-schemas';
import { getSiteCopy } from 'app/site-i18n-copy';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getDashboardLang();
  const isTh = lang === 'th';
  return {
    title: isTh ? 'เข้าสู่ระบบ | SongdeeGPS' : 'Sign in | SongdeeGPS',
    description: isTh
      ? 'เข้าสู่ระบบ SongdeeGPS เพื่อใช้แดชบอร์ดและการแจ้งเตือนความปลอดภัยของฟลีท'
      : 'Sign in to your SongdeeGPS account to access fleet safety dashboards and alerts.',
  };
}

type LoginState = {
  error: string | null;
};

export default async function LoginPage() {
  const lang = await getDashboardLang();
  const copy = getSiteCopy(lang);

  async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
    'use server';

    const pageLang = await getDashboardLang();
    const pageCopy = getSiteCopy(pageLang);
    const loginSchema = buildLoginSchema(pageCopy.validation);

    const email = formData.get('email');
    const password = formData.get('password');
    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message;
      return { error: firstError ?? pageCopy.login.invalidDetails };
    }

    const clientId = await getClientIdentifier(headers);
    const rateLimitResult = checkRateLimit(`login:${clientId}`, RATE_LIMIT_MAX_LOGIN);
    if (!rateLimitResult.ok) {
      return { error: pageCopy.rateLimitExceeded };
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
        return { error: pageCopy.login.invalidCredentials };
      }
      throw error;
    }

    return { error: null };
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 brand-pattern opacity-50" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-red-500/30 to-transparent" />

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]" aria-hidden="true">
          <svg width="400" height="520" viewBox="0 0 40 52" fill="currentColor" className="text-red-400">
            <path d="M20 0C8.95 0 0 8.95 0 20c0 14.25 20 32 20 32s20-17.75 20-32C40 8.95 31.05 0 20 0z" />
          </svg>
        </div>

        <div className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-red-600/8 blur-3xl" aria-hidden="true" />

        <div className="relative">
          <div className="inline-block rounded-xl bg-white/95 p-3 shadow-lg">
            <SongdeeLogo height={44} />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-400">{copy.fleetSafetyIntelligence}</p>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            {copy.login.taglineLead}
            <br />
            <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              {copy.login.taglineAccent}
            </span>
          </h2>
          <div className="space-y-3 text-sm text-zinc-400">
            {copy.login.bullets.map(({ icon, text }) => (
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
          <p className="text-xs text-zinc-600">{copy.copyright}</p>
        </div>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex flex-1 items-center justify-center bg-zinc-50 px-4 py-8 outline-none dark:bg-zinc-950 sm:py-10"
        style={{
          paddingTop: 'max(2rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div
          className="absolute right-4 z-10 flex items-center gap-2"
          style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <LanguageToggle lang={lang} />
          <ThemeToggle />
        </div>
        <div className="w-full min-w-0 max-w-sm animate-fade-in">
          <div className="mb-8 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-2.5 lg:hidden">
              <SongdeeLogo height={28} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {copy.login.welcomeTitle}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{copy.login.welcomeSubtitle}</p>
          </div>
          <LoginForm action={login} copy={copy.login} />
          <p className="mt-6 text-center text-xs text-zinc-400">
            {copy.login.noAccount}{' '}
            <Link
              href="/register"
              className="font-medium text-red-600 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 rounded-sm dark:text-red-400 dark:focus:ring-offset-zinc-950"
            >
              {copy.login.createOne}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
