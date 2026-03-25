'use client';

import { useEffect, useRef } from 'react';
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

  const colorClass =
    state.status === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
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

/** Close modals after server action success without synchronous setState in an effect (react-hooks/set-state-in-effect). */
export function useDeferredCloseOnSuccess(shouldClose: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    if (!shouldClose) return;
    const id = requestAnimationFrame(() => closeRef.current());
    return () => cancelAnimationFrame(id);
  }, [shouldClose]);
}
