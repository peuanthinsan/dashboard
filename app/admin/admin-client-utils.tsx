'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from './types';

export const INITIAL_STATE: ActionState = { status: 'idle', message: '' };

export function StatusMessage({
  state,
  className = '',
}: {
  state: ActionState;
  className?: string;
}) {
  if (state.status === 'idle') {
    return null;
  }

  const colorClass = state.status === 'success' ? 'text-emerald-300' : 'text-rose-300';
  return <p className={`text-xs ${colorClass} ${className}`}>{state.message}</p>;
}

export function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);
}
