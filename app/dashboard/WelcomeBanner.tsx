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
      {/* Gold accent line at top — temple trim */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

      {/* Decorative compass rose (SVG) */}
      <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.04]" aria-hidden="true">
        <svg width="180" height="180" viewBox="0 0 100 100" fill="currentColor" className="text-amber-300">
          <polygon points="50,5 55,45 50,35 45,45" />
          <polygon points="50,95 55,55 50,65 45,55" />
          <polygon points="5,50 45,45 35,50 45,55" />
          <polygon points="95,50 55,45 65,50 55,55" />
          <polygon points="50,5 58,42 50,30 42,42" opacity="0.5" />
          <polygon points="50,95 58,58 50,70 42,58" opacity="0.5" />
          <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="50" cy="50" r="2" />
        </svg>
      </div>

      {/* Subtle wave pattern at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 opacity-[0.03]" aria-hidden="true">
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="h-full w-full fill-amber-400">
          <path d="M0,30 C200,60 400,0 600,30 C800,60 1000,0 1200,30 L1200,60 L0,60 Z" />
        </svg>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-4 p-6">
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
          <p className="mt-2 text-sm text-zinc-400">
            {lang === 'th'
              ? `${dashboardCount} แดชบอร์ดพร้อมใช้งาน · กรุงเทพมหานคร`
              : `${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} · Bangkok, Thailand`}
          </p>
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
