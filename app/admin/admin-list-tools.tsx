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
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          name="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`min-w-[12rem] pl-10 ${ADMIN_INPUT}`}
          aria-label={placeholder}
        />
      </label>
      <button
        type="submit"
        className="min-h-10 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md dark:bg-white dark:text-zinc-950"
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
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-100/80 p-1 dark:bg-zinc-800/70">
      {page > 1 ? (
        <a
          href={href(prevPage)}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:text-zinc-950 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-white"
        >
          ← Prev
        </a>
      ) : null}
      <span className="px-1 text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <a
          href={href(nextPage)}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:text-zinc-950 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-white"
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
    <label className="flex min-w-44 flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{label}</span>
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
