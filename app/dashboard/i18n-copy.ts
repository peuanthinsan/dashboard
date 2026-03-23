export type DashboardLang = 'en' | 'th';

export const DASHBOARD_LANG_COOKIE = 'dashboard_lang';

export const dashboardCopy = {
  en: {
    loggedInAs: 'You are logged in as',
    dashboardIntro: 'Review performance, drill into trends, and share the latest insights with your team.',
    signOut: 'Sign out',
    yourDashboards: 'Your dashboards',
    dashboardsSubtitle: 'Jump right back into the dashboards you use most and explore the latest insights.',
    total: 'Total',
    templates: 'Templates',
    noDashboards: 'No dashboards assigned yet.',
    noDashboardsHelp: 'Ask an administrator to add a dashboard for your companies or fleets.',
    unassignedCompany: 'Other',
    dashboardCountOne: '1 dashboard',
    dashboardCountMany: 'dashboards',
    liveData: 'Live data connected',
    dataSource: 'Data source',
    openDashboard: 'Open dashboard',
    goToAdmin: 'Go to administration',
    backToDashboards: 'Back to dashboards',
    lastUpdated: 'Last updated',
    selected: 'selected',
    clear: 'Clear',
    loadingMessage: 'Loading dashboard…',
    loadingDetail: 'Fetching the latest data and dashboard insights.',
    thai: 'ไทย',
    english: 'English',
    staleData: 'Cached data',
    filtersActive: 'filters active',
    errorTitle: 'Failed to load dashboard',
    retry: 'Retry',
  },
  th: {
    loggedInAs: 'คุณเข้าสู่ระบบในชื่อ',
    dashboardIntro: 'ติดตามผลการดำเนินงาน เจาะลึกแนวโน้ม และแชร์ข้อมูลล่าสุดให้ทีมของคุณ',
    signOut: 'ออกจากระบบ',
    yourDashboards: 'แดชบอร์ดของคุณ',
    dashboardsSubtitle: 'กลับไปดูแดชบอร์ดที่ใช้บ่อย และสำรวจข้อมูลเชิงลึกล่าสุดได้ทันที',
    total: 'ทั้งหมด',
    templates: 'เทมเพลต',
    noDashboards: 'ยังไม่มีแดชบอร์ดที่ถูกกำหนดให้',
    noDashboardsHelp: 'โปรดติดต่อผู้ดูแลระบบเพื่อเพิ่มแดชบอร์ดสำหรับบริษัทหรือฟลีทของคุณ',
    unassignedCompany: 'อื่นๆ',
    dashboardCountOne: '1 แดชบอร์ด',
    dashboardCountMany: 'แดชบอร์ด',
    liveData: 'เชื่อมต่อข้อมูลสดแล้ว',
    dataSource: 'แหล่งข้อมูล',
    openDashboard: 'เปิดแดชบอร์ด',
    goToAdmin: 'ไปยังหน้าผู้ดูแลระบบ',
    backToDashboards: 'กลับไปหน้าแดชบอร์ด',
    lastUpdated: 'อัปเดตล่าสุด',
    selected: 'รายการที่เลือก',
    clear: 'ล้าง',
    loadingMessage: 'กำลังโหลดแดชบอร์ด…',
    loadingDetail: 'กำลังดึงข้อมูลล่าสุดและข้อมูลเชิงลึกของแดชบอร์ด',
    thai: 'ไทย',
    english: 'English',
    staleData: 'ข้อมูลแคช',
    filtersActive: 'ตัวกรองที่ใช้งานอยู่',
    errorTitle: 'โหลดแดชบอร์ดไม่สำเร็จ',
    retry: 'ลองอีกครั้ง',
  },
} as const;

export const getDashboardCopy = (lang: DashboardLang) => dashboardCopy[lang];

export function formatNumber(value: number, lang: DashboardLang): string {
  return new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-GB').format(value);
}

export function formatDate(date: Date, lang: DashboardLang): string {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
