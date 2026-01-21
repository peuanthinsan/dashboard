import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUser, getUser } from 'app/db';
import { RegisterForm } from 'app/register/register-form';

const registerSchema = z.object({
  email: z.string().email().max(64),
  password: z.string().min(8).max(72),
});

type RegisterState = {
  error: string | null;
};

const rateLimitWindowMs = 10 * 60 * 1000;
const maxAttemptsPerWindow = 5;
const signupAttempts = new Map<string, { count: number; lastAttempt: number }>();

export default function Login() {
  async function register(
    _prevState: RegisterState,
    formData: FormData,
  ): Promise<RegisterState> {
    'use server';
    let email = formData.get('email') as string;
    let password = formData.get('password') as string;
    const parsed = registerSchema.safeParse({ email, password });

    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Invalid form data.' };
    }

    const now = Date.now();
    const attemptKey = parsed.data.email.toLowerCase();
    const attempt = signupAttempts.get(attemptKey);

    if (attempt && now - attempt.lastAttempt < rateLimitWindowMs) {
      if (attempt.count >= maxAttemptsPerWindow) {
        return {
          error: 'Too many sign-up attempts. Please try again in a few minutes.',
        };
      }
      signupAttempts.set(attemptKey, { count: attempt.count + 1, lastAttempt: now });
    } else {
      signupAttempts.set(attemptKey, { count: 1, lastAttempt: now });
    }

    let user = await getUser(parsed.data.email);

    if (user.length > 0) {
      return { error: 'User already exists.' };
    } else {
      await createUser(parsed.data.email, parsed.data.password);
      redirect('/login');
    }
    return { error: null };
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 border-b border-gray-200 bg-white px-4 py-6 pt-8 text-center sm:px-16">
          <h3 className="text-xl font-semibold">Sign Up</h3>
          <p className="text-sm text-gray-500">
            Create an account with your email and password
          </p>
        </div>
        <RegisterForm action={register} />
      </div>
    </div>
  );
}
