'use client';

import { themeToggleClassName } from 'app/theme/ThemeToggle';
import { useCopy, useLanguage } from './LanguageProvider';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const t = useCopy();
  const next = language === 'en' ? 'th' : 'en';

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className={themeToggleClassName}
      aria-label={`${t('language')}: ${next === 'en' ? t('english') : t('thai')}`}
    >
      <span className="text-base" aria-hidden="true">🌐</span>
      {language === 'en' ? 'EN → TH' : 'TH → EN'}
    </button>
  );
}
