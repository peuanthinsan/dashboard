import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';

import { createUser, getUser } from 'app/db';
import {
  checkAndIncrementRateLimit,
  getClientIdentifier,
  RATE_LIMIT_MAX_REGISTER,
} from 'app/lib/rate-limit';
import { RegisterForm } from 'app/register/register-form';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import ThemeToggle from 'app/theme/ThemeToggle';
import LanguageToggle from 'app/dashboard/LanguageToggle';
import { getDashboardLang } from 'app/dashboard/i18n';
import { buildRegisterSchema } from 'app/lib/site-auth-schemas';
import { getSiteCopy } from 'app/site-i18n-copy';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getDashboardLang();
  const isTh = lang === 'th';
  return {
    title: isTh ? 'ลงทะเบียน | SongdeeGPS' : 'Sign up | SongdeeGPS',
    description: isTh
      ? 'สร้างบัญชี SongdeeGPS เพื่อใช้แดชบอร์ดและการติดตามความปลอดภัยของฟลีท'
      : 'Create a SongdeeGPS account to access fleet safety dashboards and monitoring.',
  };
}

type RegisterState = {
  error: string | null;
};

export default async function RegisterPage() {
  const lang = await getDashboardLang();
  const copy = getSiteCopy(lang);

  async function register(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
    'use server';

    const pageLang = await getDashboardLang();
    const pageCopy = getSiteCopy(pageLang);
    const registerSchema = buildRegisterSchema(pageCopy.validation);

    const email = formData.get('email');
    const password = formData.get('password');
    const parsed = registerSchema.safeParse({ email, password });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message;
      return { error: firstError ?? pageCopy.register.invalidDetails };
    }

    const clientId = await getClientIdentifier(headers);
    const rateLimitResult = checkAndIncrementRateLimit(`register:${clientId}`, RATE_LIMIT_MAX_REGISTER);

    if (!rateLimitResult.ok) {
      return { error: pageCopy.rateLimitExceeded };
    }

    const user = await getUser(parsed.data.email);

    if (user.length > 0) {
      return { error: pageCopy.register.emailExists };
    }

    await createUser(parsed.data.email, parsed.data.password);
    redirect('/login');
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-red-600 via-red-700 to-violet-800 p-12 lg:flex">
        <div>
          <h1 className="text-2xl font-bold text-white">{copy.register.brandTitle}</h1>
          <p className="mt-1 text-sm text-red-200">{copy.fleetSafetyIntelligence}</p>
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            {copy.register.headline}
            <br />
            {copy.register.headlineLine2}
          </h2>
          <div className="space-y-3 text-sm text-red-200">
            {copy.register.bullets.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">✓</span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-red-300">{copy.copyrightRegister}</p>
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
        <div className="w-full min-w-0 max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-2.5 lg:hidden">
              <SongdeeLogo height={28} />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{copy.register.title}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{copy.register.subtitle}</p>
          </div>
          <RegisterForm action={register} copy={copy.register} />
          <p className="mt-6 text-center text-xs text-zinc-400">
            {copy.register.hasAccount}{' '}
            <Link
              href="/login"
              className="text-red-600 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 rounded-sm dark:text-red-400 dark:focus:ring-offset-zinc-950"
            >
              {copy.register.signInLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
