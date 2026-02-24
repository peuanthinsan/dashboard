'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'th';

const STORAGE_KEY = 'songdee-language';

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'en',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'en' || stored === 'th') {
      setLanguage(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language === 'th' ? 'th' : 'en';
    }
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

type Dict = Record<string, { en: string; th: string }>;

export const copy: Dict = {
  backToDashboards: { en: 'Back to dashboards', th: 'กลับไปยังแดชบอร์ด' },
  lastUpdated: { en: 'Last updated', th: 'อัปเดตล่าสุด' },
  youAreLoggedInAs: { en: 'You are logged in as', th: 'คุณเข้าสู่ระบบในชื่อ' },
  dashboardIntro: {
    en: 'Review performance, drill into trends, and share the latest insights with your team.',
    th: 'ตรวจสอบประสิทธิภาพ เจาะลึกแนวโน้ม และแชร์ข้อมูลเชิงลึกล่าสุดกับทีมของคุณ',
  },
  signOut: { en: 'Sign out', th: 'ออกจากระบบ' },
  yourDashboards: { en: 'Your dashboards', th: 'แดชบอร์ดของคุณ' },
  dashboardListIntro: {
    en: 'Jump right back into the dashboards you use most and explore the latest insights.',
    th: 'กลับเข้าสู่แดชบอร์ดที่คุณใช้งานบ่อย และสำรวจข้อมูลเชิงลึกล่าสุด',
  },
  total: { en: 'Total', th: 'ทั้งหมด' },
  templates: { en: 'Templates', th: 'เทมเพลต' },
  noDashboardsYet: { en: 'No dashboards assigned yet.', th: 'ยังไม่มีแดชบอร์ดที่ถูกกำหนดให้' },
  askAdmin: {
    en: 'Ask an administrator to add a dashboard for your companies or fleets.',
    th: 'โปรดติดต่อผู้ดูแลระบบเพื่อเพิ่มแดชบอร์ดสำหรับบริษัทหรือกองยานของคุณ',
  },
  liveDataConnected: { en: 'Live data connected', th: 'เชื่อมต่อข้อมูลสดแล้ว' },
  dataSource: { en: 'Data source', th: 'แหล่งข้อมูล' },
  openDashboard: { en: 'Open dashboard', th: 'เปิดแดชบอร์ด' },
  selected: { en: 'selected', th: 'ที่เลือก' },
  clear: { en: 'Clear', th: 'ล้าง' },
  loadingDetail: { en: 'Fetching the latest data and dashboard insights.', th: 'กำลังดึงข้อมูลล่าสุดและข้อมูลเชิงลึกของแดชบอร์ด' },
  goToAdministration: { en: 'Go to administration', th: 'ไปยังหน้าผู้ดูแลระบบ' },
  language: { en: 'Language', th: 'ภาษา' },
  english: { en: 'English', th: 'อังกฤษ' },
  thai: { en: 'Thai', th: 'ไทย' },
};

export function useCopy() {
  const { language } = useLanguage();
  return (key: keyof typeof copy) => copy[key][language];
}
