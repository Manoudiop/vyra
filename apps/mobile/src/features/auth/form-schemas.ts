import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@vyra/shared';
import { type TFunction } from 'i18next';
import { z } from 'zod';

/**
 * Client-side mirrors of the shared auth schemas with translated messages.
 * The API re-validates everything with @vyra/shared; these only drive the UX.
 */
export function makeAuthSchemas(t: TFunction) {
  const email = z
    .string()
    .trim()
    .min(1, t('validation.required'))
    .pipe(z.email(t('validation.email')));

  const newPassword = z
    .string()
    .min(PASSWORD_MIN_LENGTH, t('validation.passwordMin'))
    .max(PASSWORD_MAX_LENGTH)
    .regex(/[A-Za-z]/, t('validation.passwordLetter'))
    .regex(/\d/, t('validation.passwordDigit'));

  return {
    login: z.object({ email, password: z.string().min(1, t('validation.required')) }),
    register: z.object({
      firstName: z.string().trim().min(1, t('validation.required')).max(60),
      email,
      password: newPassword,
    }),
    forgot: z.object({ email }),
    reset: z.object({
      code: z.string().regex(/^\d{6}$/, t('validation.code')),
      newPassword,
    }),
  };
}

export type AuthSchemas = ReturnType<typeof makeAuthSchemas>;
export type LoginForm = z.infer<AuthSchemas['login']>;
export type RegisterForm = z.infer<AuthSchemas['register']>;
export type ForgotForm = z.infer<AuthSchemas['forgot']>;
export type ResetForm = z.infer<AuthSchemas['reset']>;
