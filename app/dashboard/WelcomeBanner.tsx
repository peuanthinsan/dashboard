type WelcomeBannerProps = {
  email: string;
  dashboardCount: number;
  lang: 'en' | 'th';
};

export default function WelcomeBanner({ email, dashboardCount, lang }: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900 via-red-950/80 to-zinc-900 p-6 shadow-card-raised">
      {/* Decorative glow orbs */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-red-600/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-red-400/90">
            {lang === 'th' ? 'ยินดีต้อนรับกลับ กัปตัน' : 'Welcome back, Captain'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{email}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {lang === 'th'
              ? `คุณมี ${dashboardCount} แดชบอร์ด`
              : `You have ${dashboardCount} dashboard${dashboardCount !== 1 ? 's' : ''} available`}
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 backdrop-blur-sm">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-red-400" />
            <div className="absolute inset-0 animate-ping rounded-full bg-red-400/50" />
          </div>
          <span className="text-sm font-medium text-red-100">
            {lang === 'th' ? 'เชื่อมต่อข้อมูลสด' : 'Live data connected'}
          </span>
        </div>
      </div>
    </div>
  );
}
