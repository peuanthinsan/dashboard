'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type DashboardLanguage = 'en' | 'th';

const DashboardLanguageContext = createContext<{
  language: DashboardLanguage;
  setLanguage: (language: DashboardLanguage) => void;
}>({
  language: 'th',
  setLanguage: () => {},
});

const STORAGE_KEY = 'dashboard-language';

export function DashboardLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<DashboardLanguage>('th');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'th') {
      setLanguage(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <DashboardLanguageContext.Provider value={value}>{children}</DashboardLanguageContext.Provider>;
}

export function useDashboardLanguage() {
  return useContext(DashboardLanguageContext);
}

export function tr(language: DashboardLanguage, english: string, thai: string) {
  return language === 'th' ? thai : english;
}
