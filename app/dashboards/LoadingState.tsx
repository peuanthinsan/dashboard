'use client';

import { useLanguage } from 'app/i18n';

type LoadingStateProps = {
  message: string;
  detail?: string;
};

export default function LoadingState({ message, detail }: LoadingStateProps) {
  const { language } = useLanguage();

  return (
    <section
      className="rounded-3xl border border-fuchsia-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-indigo-800/70 dark:bg-slate-900/70"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-500/20 opacity-70" />
          <svg className="relative h-6 w-6 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {detail ?? (language === 'th' ? 'กำลังดึงข้อมูลล่าสุดและสรุปผลแดชบอร์ด' : 'Fetching the latest data and dashboard insights.')}
          </p>
        </div>
      </div>
    </section>
  );
}
