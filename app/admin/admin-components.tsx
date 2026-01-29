import type { ReactNode } from 'react';
import {
  ADMIN_CARD,
  ADMIN_CARD_GRADIENT,
  ADMIN_SECTION,
  ADMIN_SECTION_BADGE,
  ADMIN_SECTION_HEADER,
  ADMIN_SECTION_KICKER,
  ADMIN_STAT_GRID,
  ADMIN_STAT_LABEL,
} from './admin-ui';

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

type AdminSectionProps = {
  children: ReactNode;
  className?: string;
};

export function AdminSection({ children, className }: AdminSectionProps) {
  return <section className={cx(ADMIN_SECTION, className)}>{children}</section>;
}

type AdminSectionHeaderProps = {
  kicker: string;
  title: string;
  description: string;
  badgeText?: string;
};

export function AdminSectionHeader({
  kicker,
  title,
  description,
  badgeText,
}: AdminSectionHeaderProps) {
  return (
    <header className={ADMIN_SECTION_HEADER}>
      <div>
        <p className={ADMIN_SECTION_KICKER}>{kicker}</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {badgeText ? <span className={ADMIN_SECTION_BADGE}>{badgeText}</span> : null}
    </header>
  );
}

type AdminCardProps = {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'gradient';
};

export function AdminCard({ children, className, variant = 'default' }: AdminCardProps) {
  const baseClass = variant === 'gradient' ? ADMIN_CARD_GRADIENT : ADMIN_CARD;
  return <div className={cx(baseClass, className)}>{children}</div>;
}

type AdminStatProps = {
  label: string;
  value: ReactNode;
  description: string;
  className?: string;
  variant?: 'default' | 'gradient';
};

export function AdminStat({ label, value, description, className, variant }: AdminStatProps) {
  return (
    <AdminCard className={className} variant={variant}>
      <p className={ADMIN_STAT_LABEL}>{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </AdminCard>
  );
}

type AdminStatGridProps = {
  children: ReactNode;
  className?: string;
};

export function AdminStatGrid({ children, className }: AdminStatGridProps) {
  return <div className={cx(ADMIN_STAT_GRID, className)}>{children}</div>;
}

type AdminListCardProps = {
  title: string;
  items: string[];
  className?: string;
  variant?: 'default' | 'gradient';
};

export function AdminListCard({ title, items, className, variant = 'default' }: AdminListCardProps) {
  return (
    <AdminCard className={className} variant={variant}>
      <p className={ADMIN_STAT_LABEL}>{title}</p>
      <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </AdminCard>
  );
}

type AdminNoteCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'gradient';
};

export function AdminNoteCard({
  title,
  children,
  className,
  variant = 'default',
}: AdminNoteCardProps) {
  return (
    <AdminCard className={className} variant={variant}>
      <p className={ADMIN_STAT_LABEL}>{title}</p>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </AdminCard>
  );
}
