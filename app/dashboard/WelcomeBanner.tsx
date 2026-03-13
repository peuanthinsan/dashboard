import SongdeeLogo from 'app/ui/SongdeeLogo';

type WelcomeBannerProps = {
  email: string;
  dashboardCount: number;
  lang: 'en' | 'th';
};

export default function WelcomeBanner({ email, dashboardCount, lang }: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/40 shadow-card-raised">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950" />
      {/* Brand pattern overlay — subtle GPS pin grid */}
      <div className="absolute inset-0 brand-pattern opacity-60" />

      {/* Red accent top bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      {/* Subtle glow */}
      <div className="pointer-events-none absolute -right-12 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-red-600/5 blur-3xl" aria-hidden="true" />

      <div className="relative flex flex-wrap items-center justify-between gap-4 p-6 pt-5">
        <div className="flex items-start gap-4">
          {/* Official SongdeeGPS logo */}
          <div className="hidden rounded-lg bg-white/95 p-1.5 shadow-sm sm:block">
            <SongdeeLogo height={36} />
          </div>
          <div>
            <p className="text-sm font-medium text-red-400/80">
              {lang === 'th' ? 'ยินดีต้อนรับกลับ' : 'Welcome back'}
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-white">{email}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {lang === 'th'
                ? `${dashboardCount} แดชบอร์ดพร้อมใช้งาน`
                : `${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} available`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 backdrop-blur-sm">
            <div className="relative">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
            </div>
            <span className="text-sm font-medium text-red-100">
              {lang === 'th' ? 'ข้อมูลสด' : 'Live'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
