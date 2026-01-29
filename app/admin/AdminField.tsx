'use client';

import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';
import { ADMIN_FIELD_LABEL, ADMIN_HELP_TEXT } from './admin-ui';

type AdminFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  className?: string;
  children: ReactNode;
};

export default function AdminField({
  id,
  label,
  required = false,
  helperText,
  className,
  children,
}: AdminFieldProps) {
  const describedBy = helperText ? `${id}-help` : undefined;
  const content = isValidElement(children)
    ? cloneElement(children as ReactElement, {
        id,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={id} className={ADMIN_FIELD_LABEL}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      {content}
      {helperText ? (
        <p id={describedBy} className={ADMIN_HELP_TEXT}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
