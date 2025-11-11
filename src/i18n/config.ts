// =============================================================================
// i18n Configuration
// Technical Building Block: P01 - User Interface Extension (Localization)
// =============================================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import ko from './locales/ko.json';

// Detect browser language
const getBrowserLanguage = () => {
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage) return savedLanguage;
  
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ko')) return 'ko';
  if (browserLang.startsWith('es')) return 'es';
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ko: { translation: ko },
    },
    lng: getBrowserLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
