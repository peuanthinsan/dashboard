import { filterChipActive, filterChipMuted } from 'app/ui/design-tokens';

// Backward-compatible exports updated to use V2 design tokens
export const chipClassName = `${filterChipActive} cursor-pointer`;
export const chipMutedClassName = `${filterChipMuted} cursor-pointer`;

type FilterChipProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  active?: boolean;
};

export function FilterChip({ children, onClick, className, type = 'button', active = false }: FilterChipProps) {
  const baseClass = active ? chipClassName : chipMutedClassName;
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={active}
      className={[baseClass, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
