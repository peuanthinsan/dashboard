import { z } from 'zod';

import type { SiteCopy } from 'app/site-i18n-copy';

export function buildLoginSchema(v: SiteCopy['validation']) {
  return z.object({
    email: z.string({ error: v.emailRequired }).trim().email({ error: v.emailInvalid }),
    password: z
      .string({ error: v.passwordRequired })
      .min(8, { error: v.passwordMin8 })
      .max(72, { error: v.passwordMax72 }),
  });
}

export function buildRegisterSchema(v: SiteCopy['validation']) {
  return buildLoginSchema(v);
}

export function buildChangePasswordSchema(v: SiteCopy['validation']) {
  return z
    .object({
      currentPassword: z.string().min(1, { error: v.currentPasswordRequired }),
      newPassword: z.string().min(8, { error: v.newPasswordMin }).max(72, { error: v.newPasswordMax }),
      confirmPassword: z.string().min(1, { error: v.confirmPasswordRequired }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      error: v.passwordsMismatch,
      path: ['confirmPassword'],
    });
}
