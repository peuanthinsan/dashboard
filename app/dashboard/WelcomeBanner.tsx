import SongdeeLogo from 'app/ui/SongdeeLogo';

type WelcomeBannerProps = {
  email: string;
  dashboardCount: number;
  lang: 'en' | 'th';
};

export default function WelcomeBanner({ email, dashboardCount, lang }: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200/60 shadow-card-raised dark:border-zinc-800/40">
      {/* Gradient background — light/dark aware */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950" />
      {/* Brand pattern overlay — subtle GPS pin grid */}
      <div className="absolute inset-0 brand-pattern opacity-40 dark:opacity-60" />

      {/* Red accent top bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      {/* Subtle glow */}
      <div className="pointer-events-none absolute -right-12 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-red-600/5 blur-3xl" aria-hidden="true" />

      <div className="relative flex flex-col gap-4 p-4 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {/* Official SongdeeGPS logo */}
          <div className="shrink-0 rounded-lg bg-white/95 p-1 shadow-sm dark:bg-white/95 sm:p-1.5">
            <SongdeeLogo height={32} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-600/90 dark:text-red-400/80">
              {lang === 'th' ? 'ยินดีต้อนรับกลับ' : 'Welcome back'}
            </p>
            <h1 className="mt-0.5 break-words text-lg font-bold tracking-tight text-zinc-900 sm:text-xl dark:text-white">
              {email}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {lang === 'th'
                ? `${dashboardCount} แดชบอร์ดพร้อมใช้งาน`
                : `${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} available`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:justify-end">
          <div className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-red-300/60 bg-red-50/90 px-3 py-2 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 sm:w-auto sm:px-4">
            <div className="relative">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
            </div>
            <span className="text-sm font-medium text-red-700 dark:text-red-100">
              {lang === 'th' ? 'ข้อมูลสด' : 'Live'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
