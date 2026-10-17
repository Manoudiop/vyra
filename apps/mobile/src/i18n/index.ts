import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { fr } from './fr';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** French by default; English when the device prefers it. */
export function detectLanguage(): Language {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return deviceLanguage === 'en' ? 'en' : 'fr';
}

// eslint-disable-next-line import/no-named-as-default-member -- i18next documents `i18n.use()`.
void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
