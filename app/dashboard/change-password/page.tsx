export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { compare } from 'bcrypt-ts';
import { auth } from 'app/auth';
import { getUserForAuth, updateUserProfile } from 'app/db';
import { getDashboardLang } from 'app/dashboard/i18n';
import { ChangePasswordForm } from './change-password-form';
import { pageContainer, pageContent } from 'app/ui/design-tokens';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'Current password is required.' }),
    newPassword: z
      .string()
      .min(8, { error: 'New password must be at least 8 characters.' })
      .max(72, { error: 'New password must be at most 72 characters.' }),
    confirmPassword: z.string().min(1, { error: 'Please confirm your new password.' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ChangePasswordState = {
  error: string | null;
  success: boolean;
};

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const lang = await getDashboardLang();

  async function changePassword(
    _prevState: ChangePasswordState,
    formData: FormData,
  ): Promise<ChangePasswordState> {
    'use server';

    const session = await auth();
    if (!session?.user?.email) {
      return { error: 'Not authenticated.', success: false };
    }

    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message;
      return { error: firstError ?? 'Invalid input.', success: false };
    }

    const userRows = await getUserForAuth(session.user.email);
    if (userRows.length === 0) {
      return { error: 'User not found.', success: false };
    }

    const user = userRows[0];
    const isValid = await compare(parsed.data.currentPassword, user.password!);
    if (!isValid) {
      return { error: lang === 'th' ? 'รหัสผ่านปัจจุบันไม่ถูกต้อง' : 'Current password is incorrect.', success: false };
    }

    await updateUserProfile({
      id: user.id,
      email: session.user.email,
      password: parsed.data.newPassword,
    });

    return { error: null, success: true };
  }

  return (
    <div className={pageContainer}>
      <div className={pageContent}>
        <div className="mx-auto max-w-sm py-12">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-6 w-6 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {lang === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change password'}
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {lang === 'th' ? 'กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' : 'Enter your current password and a new password'}
            </p>
          </div>
          <ChangePasswordForm action={changePassword} lang={lang} />
        </div>
      </div>
    </div>
  );
}
