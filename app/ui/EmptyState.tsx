import { SongdeePinIcon } from './SongdeeLogo';
import { textMuted, textSecondary } from './design-tokens';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'dashboard';
};

export default function EmptyState({
  title,
  description,
  icon,
  variant = 'default',
}: EmptyStateProps) {
  const isDashboard = variant === 'dashboard';

  const defaultIcon = icon ?? (
    isDashboard ? (
      <SongdeePinIcon size={48} className="text-red-500/80 dark:text-red-400/80" />
    ) : (
      <svg
        className="h-10 w-10 text-zinc-400 dark:text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
    )
  );

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        isDashboard
          ? 'gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 px-8 py-16 dark:border-zinc-800 dark:bg-zinc-900/30'
          : 'gap-3 py-12'
      }`}
    >
      {defaultIcon}
      <div className="max-w-sm">
        <p className={`font-medium ${textSecondary}`}>{title}</p>
        {description && (
          <p className={`mt-1.5 ${textMuted}`}>{description}</p>
        )}
      </div>
    </div>
  );
}
