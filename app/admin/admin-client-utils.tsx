'use client';

import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from './types';

export const INITIAL_STATE: ActionState = { status: 'idle', message: '' };

export function StatusMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle') {
    return null;
  }

  const colorClass = state.status === 'success' ? 'text-emerald-300' : 'text-rose-300';
  return <p className={`text-xs ${colorClass}`}>{state.message}</p>;
}

export function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);
}

export function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
  if (!window.confirm('Are you sure you want to delete this item?')) {
    event.preventDefault();
  }
}
