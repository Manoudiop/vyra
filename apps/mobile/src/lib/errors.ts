import { type TFunction } from 'i18next';
import { ApiError } from './api-client';

/** User-facing, translated message for any thrown value. */
export function errorMessage(
  error: unknown,
  t: TFunction,
  /** Screen-specific wording for some codes (e.g. AUTH_REQUIRED on the login form). */
  overrides: Partial<Record<ApiError['code'], string>> = {},
): string {
  if (error instanceof ApiError) {
    const override = overrides[error.code];
    if (override) return override;
    if (error.code === 'NETWORK_ERROR') return t('errors.network');
    return t(`errors.${error.code}`);
  }
  return t('errors.generic');
}
