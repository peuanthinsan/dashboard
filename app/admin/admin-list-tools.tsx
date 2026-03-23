'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ADMIN_INPUT, ADMIN_SELECT } from './admin-ui';

type AdminSearchInputProps = {
  placeholder?: string;
  defaultValue?: string;
  paramKey?: string;
};

export function AdminSearchInput({
  placeholder = 'Search…',
  defaultValue = '',
  paramKey = 'search',
}: AdminSearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>('input[name="search"]');
    const value = input?.value?.trim() ?? '';
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('page', '1');
    if (value) params.set(paramKey, value);
    else params.delete(paramKey);
    router.push(`?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="search"
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`min-w-[12rem] ${ADMIN_INPUT}`}
        aria-label={placeholder}
      />
      <button
        type="submit"
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        Search
      </button>
    </form>
  );
}

type AdminPaginationProps = {
  page: number;
  totalPages: number;
};

export function AdminPagination({ page, totalPages }: AdminPaginationProps) {
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? '';

  if (totalPages <= 1) return null;

  const params = new URLSearchParams(query);
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  function href(p: number) {
    params.set('page', String(p));
    return `?${params.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      {page > 1 ? (
        <a
          href={href(prevPage)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          ← Prev
        </a>
      ) : null}
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <a
          href={href(nextPage)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          Next →
        </a>
      ) : null}
    </nav>
  );
}

type AdminFilterSelectProps = {
  label: string;
  options: { value: string; label: string }[];
  paramKey: string;
  defaultValue?: string;
};

export function AdminFilterSelect({
  label,
  options,
  paramKey,
  defaultValue = '',
}: AdminFilterSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('page', '1');
    const v = e.target.value;
    if (v) params.set(paramKey, v);
    else params.delete(paramKey);
    router.push(`?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <select
        defaultValue={defaultValue}
        onChange={handleChange}
        className={ADMIN_SELECT}
        aria-label={label}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
