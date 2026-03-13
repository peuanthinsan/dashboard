import { cardSection } from 'app/ui/design-tokens';

type WelcomeBannerProps = {
  email: string;
  dashboardCount: number;
  lang: 'en' | 'th';
};

export default function WelcomeBanner({ email, dashboardCount, lang }: WelcomeBannerProps) {
  return (
    <div className={`${cardSection} bg-gradient-to-r from-zinc-900 via-red-900 to-zinc-900 !border-transparent`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-red-300">
            {lang === 'th' ? 'ยินดีต้อนรับกลับ กัปตัน' : 'Welcome back, Captain'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{email}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {lang === 'th'
              ? `คุณมี ${dashboardCount} แดชบอร์ด`
              : `You have ${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} available`}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 backdrop-blur">
          <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          <span className="text-sm font-medium text-white">
            {lang === 'th' ? 'เชื่อมต่อข้อมูลสด' : 'Live data connected'}
          </span>
        </div>
      </div>
    </div>
  );
}
