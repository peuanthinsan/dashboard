import { AuthError } from 'next-auth';
import { z } from 'zod';

import { signIn } from 'app/auth';
import { LoginForm } from 'app/login/login-form';

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

    try {
      await signIn('credentials', {
        redirectTo: '/dashboard',
        email: parsed.data.email,
        password: parsed.data.password,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return { error: 'Invalid email or password.' };
      }
      throw error;
    }

    return { error: null };
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — SongdeeGPS brand identity */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-zinc-950 via-red-950/90 to-zinc-950 p-12 lg:flex">
        {/* Gold accent line — Thai temple trim */}
        <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-amber-500/30 to-transparent" />

        {/* Decorative compass rose */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]" aria-hidden="true">
          <svg width="400" height="400" viewBox="0 0 100 100" fill="currentColor" className="text-amber-300">
            <polygon points="50,2 55,44 50,32 45,44" />
            <polygon points="50,98 55,56 50,68 45,56" />
            <polygon points="2,50 44,45 32,50 44,55" />
            <polygon points="98,50 56,45 68,50 56,55" />
            <polygon points="15,15 46,44 30,30 44,46" opacity="0.4" />
            <polygon points="85,85 54,56 70,70 56,54" opacity="0.4" />
            <polygon points="85,15 56,44 70,30 54,46" opacity="0.4" />
            <polygon points="15,85 44,56 30,70 46,54" opacity="0.4" />
            <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="3" />
          </svg>
        </div>

        {/* Decorative glow */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-red-600/8 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-16 bottom-1/3 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" aria-hidden="true" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white">
              Songdee<span className="text-amber-400">GPS</span>
            </h1>
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400/80 ring-1 ring-amber-500/20">
              AI Fleet
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-red-400/70">
            Fleet Safety Intelligence · กรุงเทพมหานคร
          </p>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            นำทาง · พิชิต
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">
              Command your fleet.
            </span>
          </h2>
          <div className="space-y-3 text-sm text-red-200/70">
            {[
              { icon: '⚓', text: 'Real-time driver safety alerts' },
              { icon: '🧭', text: 'AI-powered fleet analytics' },
              { icon: '🛡️', text: 'Safety score tracking & compliance' },
              { icon: '📊', text: 'Exportable reports & insights' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-sm ring-1 ring-amber-500/15">
                  {icon}
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-zinc-500">
            © 2026 SongdeeGPS — สงดีจีพีเอส · กรุงเทพมหานคร
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 text-center lg:text-left">
            {/* Mobile brand — visible only on small screens */}
            <p className="mb-4 text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 lg:hidden">
              Songdee<span className="text-amber-500">GPS</span>
            </p>
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
