import SongdeeLogo from 'app/ui/SongdeeLogo';

type WelcomeBannerProps = {
  email: string;
  dashboardCount: number;
  lang: 'en' | 'th';
};

export default function WelcomeBanner({ email, dashboardCount, lang }: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200/60 shadow-card-raised dark:border-zinc-800/40">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 dark:from-zinc-900 dark:via-zinc-950 dark:to-red-950" />
      {/* Brand pattern overlay — subtle GPS pin grid */}
      <div className="absolute inset-0 brand-pattern opacity-20" />

      {/* Red accent top bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      {/* Subtle glow */}
      <div className="pointer-events-none absolute -right-12 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-red-600/5 blur-3xl" aria-hidden="true" />

      <div className="relative flex flex-col gap-4 p-4 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {/* Official SongdeeGPS logo */}
          <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-lg shadow-black/15 sm:p-2">
            <SongdeeLogo height={32} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-300">
              {lang === 'th' ? 'ยินดีต้อนรับกลับ' : 'Welcome back'}
            </p>
            <h1 className="mt-0.5 break-words text-xl font-bold tracking-tight text-white sm:text-2xl">
              {email}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {lang === 'th'
                ? `${dashboardCount} แดชบอร์ดพร้อมใช้งาน`
                : `${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} available`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:justify-end">
          <div className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 backdrop-blur-sm sm:w-auto sm:px-4">
            <svg aria-hidden="true" className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
            </svg>
            <span className="text-sm font-semibold text-white">
              {lang === 'th' ? 'พื้นที่ทำงานพร้อมใช้งาน' : 'Workspace ready'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
