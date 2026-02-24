'use client';

import { themeToggleClassName } from './ThemeToggle';
import { useLanguage } from 'app/i18n';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'th' ? 'en' : 'th';

  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      className={themeToggleClassName}
      aria-label={language === 'th' ? 'สลับเป็นภาษาอังกฤษ' : 'Switch to Thai'}
    >
      <span className="text-base">🌐</span>
      {language === 'th' ? 'ภาษาไทย' : 'English'}
    </button>
  );
}
