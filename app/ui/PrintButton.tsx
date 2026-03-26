'use client';

type PrintButtonProps = {
  label?: string;
  className?: string;
};

export default function PrintButton({ label = 'Print / PDF', className = '' }: PrintButtonProps) {
  return (
    <button
      type="button"
      data-print-hide
      onClick={() => window.print()}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700/60 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-zinc-600 sm:w-auto ${className}`}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
        />
      </svg>
      {label}
    </button>
  );
}
