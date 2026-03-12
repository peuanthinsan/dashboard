import { textMuted, textSecondary } from './design-tokens';

type EmptyStateProps = { title: string; description?: string; icon?: React.ReactNode };

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon ?? (
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
      )}
      <div>
        <p className={`font-medium ${textSecondary}`}>{title}</p>
        {description && <p className={`mt-1 ${textMuted}`}>{description}</p>}
      </div>
    </div>
  );
}
