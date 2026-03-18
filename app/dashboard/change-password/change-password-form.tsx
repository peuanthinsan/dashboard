'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { inputBase, labelBase, btnPrimary, btnSecondary, btnSmall } from 'app/ui/design-tokens';

type ChangePasswordState = {
  error: string | null;
  success: boolean;
};

const initialState: ChangePasswordState = {
  error: null,
  success: false,
};

function FormError({ message }: { message: string | null }) {
  const { pending } = useFormStatus();
  if (!message || pending) return null;
  return (
    <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

function SubmitButton({ lang }: { lang: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending}
      className={`${btnPrimary} w-full py-2.5`}
    >
      {pending ? (
        <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : lang === 'th' ? (
        'เปลี่ยนรหัสผ่าน'
      ) : (
        'Change password'
      )}
    </button>
  );
}

export function ChangePasswordForm({
  action,
  lang,
}: {
  action: (state: ChangePasswordState, formData: FormData) => Promise<ChangePasswordState>;
  lang: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  if (state.success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {lang === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จแล้ว' : 'Password changed successfully'}
        </p>
        <Link href="/dashboard" className={`${btnSecondary} ${btnSmall} inline-flex`}>
          {lang === 'th' ? '← กลับไปหน้าแดชบอร์ด' : '← Back to dashboards'}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="currentPassword" className={labelBase}>
          {lang === 'th' ? 'รหัสผ่านปัจจุบัน' : 'Current password'}
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor="newPassword" className={labelBase}>
          {lang === 'th' ? 'รหัสผ่านใหม่' : 'New password'}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelBase}>
          {lang === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm new password'}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton lang={lang} />
      <div className="text-center">
        <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          {lang === 'th' ? '← กลับไปหน้าแดชบอร์ด' : '← Back to dashboards'}
        </Link>
      </div>
    </form>
  );
}
