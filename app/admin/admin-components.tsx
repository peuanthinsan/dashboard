import type { ReactNode } from 'react';
import {
  ADMIN_CARD,
  ADMIN_CARD_GRADIENT,
  ADMIN_PILL,
  ADMIN_SECTION,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from './admin-ui';
import { heading2, textSecondary } from 'app/ui/design-tokens';

type AdminSectionProps = {
  children: ReactNode;
  className?: string;
};

type AdminSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  count: number;
  countLabel?: string;
};

type AdminStatCardProps = {
  label: string;
  value?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  variant?: 'default' | 'gradient';
  descriptionTone?: 'muted' | 'subtle';
  className?: string;
};

type AdminPanelProps = {
  children: ReactNode;
  className?: string;
};

export function AdminSection({ children, className }: AdminSectionProps) {
  return <section className={className ? `${ADMIN_SECTION} ${className}` : ADMIN_SECTION}>{children}</section>;
}

export function AdminSectionHeader({
  eyebrow,
  title,
  description,
  count,
  countLabel = 'total',
}: AdminSectionHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`mt-2 ${heading2}`}>{title}</h2>
        <p className={`mt-1 ${textSecondary}`}>{description}</p>
      </div>
      <span className={`${ADMIN_PILL} tabular-nums`}>
        {count} {countLabel}
      </span>
    </header>
  );
}

export function AdminStatCard({
  label,
  value,
  description,
  children,
  variant = 'default',
  descriptionTone = 'subtle',
  className,
}: AdminStatCardProps) {
  const cardClassName = variant === 'gradient' ? ADMIN_CARD_GRADIENT : ADMIN_CARD;
  const descriptionClassName = descriptionTone === 'muted' ? ADMIN_TEXT_MUTED : ADMIN_TEXT_SUBTLE;
  return (
    <div className={className ? `${cardClassName} ${className}` : cardClassName}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      {value !== undefined ? (
        <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
      ) : null}
      {description ? <p className={`mt-1 text-xs ${descriptionClassName}`}>{description}</p> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export function AdminPanel({ children, className }: AdminPanelProps) {
  return <div className={className ? `${ADMIN_SECTION} ${className}` : ADMIN_SECTION}>{children}</div>;
}
