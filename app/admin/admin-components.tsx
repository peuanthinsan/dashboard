import type { ReactNode } from 'react';
import {
  ADMIN_CARD,
  ADMIN_CARD_GRADIENT,
  ADMIN_PILL,
  ADMIN_SECTION,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from './admin-ui';

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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className={`mt-1 text-sm ${ADMIN_TEXT_MUTED}`}>{description}</p>
      </div>
      <span className={ADMIN_PILL}>
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      {value !== undefined ? (
        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      ) : null}
      {description ? <p className={`mt-1 text-xs ${descriptionClassName}`}>{description}</p> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export function AdminPanel({ children, className }: AdminPanelProps) {
  const baseClassName =
    'rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60';
  return <div className={className ? `${baseClassName} ${className}` : baseClassName}>{children}</div>;
}
