import SongdeeLogo from 'app/ui/SongdeeLogo';

type WelcomeBannerProps = {
  email: string;
  dashboardCount: number;
  lang: 'en' | 'th';
};

export default function WelcomeBanner({ email, dashboardCount, lang }: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/40 shadow-card-raised">
      {/* Thai temple gradient — deep red to black with gold warmth */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-red-950 to-zinc-950" />
      {/* Thai geometric pattern overlay */}
      <div className="absolute inset-0 thai-pattern opacity-60" />

      {/* Gold double-line top trim — Thai temple inspired */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
      <div className="absolute inset-x-[15%] top-[4px] h-[1px] bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />

      {/* Decorative compass rose (large, background) */}
      <div className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 opacity-[0.06]" aria-hidden="true">
        <svg width="200" height="200" viewBox="0 0 100 100" fill="currentColor" className="text-amber-300">
          <polygon points="50,5 55,45 50,35 45,45" />
          <polygon points="50,95 55,55 50,65 45,55" />
          <polygon points="5,50 45,45 35,50 45,55" />
          <polygon points="95,50 55,45 65,50 55,55" />
          <polygon points="50,5 58,42 50,30 42,42" opacity="0.5" />
          <polygon points="50,95 58,58 50,70 42,58" opacity="0.5" />
          <polygon points="15,15 46,44 30,30 44,46" opacity="0.3" />
          <polygon points="85,85 54,56 70,70 56,54" opacity="0.3" />
          <polygon points="85,15 56,44 70,30 54,46" opacity="0.3" />
          <polygon points="15,85 44,56 30,70 46,54" opacity="0.3" />
          <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="50" cy="50" r="2" />
        </svg>
      </div>

      {/* Subtle wave pattern at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 opacity-[0.04]" aria-hidden="true">
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="h-full w-full fill-amber-400">
          <path d="M0,30 C200,60 400,0 600,30 C800,60 1000,0 1200,30 L1200,60 L0,60 Z" />
        </svg>
      </div>

      {/* Corner Thai diamond ornaments */}
      <div className="pointer-events-none absolute left-3 top-3 opacity-[0.06]" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
          <polygon points="12,2 22,12 12,22 2,12" />
        </svg>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-4 p-6 pt-7">
        <div className="flex items-start gap-4">
          {/* SongdeeGPS Logo */}
          <div className="hidden sm:block">
            <SongdeeLogo size={48} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              {/* SongdeeGPS wordmark */}
              <span className="text-lg font-black tracking-tight text-white">
                Songdee<span className="text-amber-400">GPS</span>
              </span>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400/80 ring-1 ring-amber-500/20">
                {lang === 'th' ? 'ระบบ AI' : 'AI Fleet'}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-red-300/80">
              {lang === 'th' ? 'ยินดีต้อนรับกลับ กัปตัน' : 'Welcome back, Captain'}
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-white">{email}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
              <svg className="h-3.5 w-3.5 text-amber-500/60" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>
                {lang === 'th'
                  ? `${dashboardCount} แดชบอร์ดพร้อมใช้งาน · กรุงเทพมหานคร`
                  : `${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} · Bangkok, Thailand`}
              </span>
            </div>
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
