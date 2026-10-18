import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { profileApi, profileQueryKey } from '@/features/profile/profile-api';

/**
 * The account's language (chosen at signup or in Settings) wins over the
 * device's: the app and the AI-written texts then speak the same language.
 */
export function LanguageSync() {
  const { i18n } = useTranslation();
  const profile = useQuery({ queryKey: profileQueryKey, queryFn: profileApi.get });
  const locale = profile.data?.locale;
  useEffect(() => {
    if (locale && (locale === 'fr' || locale === 'en') && locale !== i18n.language) {
      void i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);
  return null;
}
