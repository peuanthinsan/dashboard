type FilterChipProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
};

export const chipClassName =
  'rounded-full border border-indigo-300 bg-indigo-100 px-3 py-1 text-xs text-indigo-700 dark:border-indigo-400/70 dark:bg-indigo-500/20 dark:text-indigo-100';

export const chipMutedClassName =
  'rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-500';

export function FilterChip({ children, onClick, className, type = 'button' }: FilterChipProps) {
  return (
    <button type={type} onClick={onClick} className={[chipClassName, className].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}
