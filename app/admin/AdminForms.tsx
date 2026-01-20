'use client';

import { useEffect, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { ActionState } from './actions';

const initialState: ActionState = { status: 'idle', message: '' };

type ActionHandler = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

const StatusMessage = ({ state }: { state: ActionState }) => {
  if (state.status === 'idle' || !state.message) {
    return null;
  }
  const tone =
    state.status === 'success'
      ? 'text-emerald-200 bg-emerald-500/10 border-emerald-500/20'
      : 'text-rose-200 bg-rose-500/10 border-rose-500/20';
  return (
    <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${tone}`} role="status">
      {state.message}
    </p>
  );
};

const PendingText = ({ label }: { label?: string }) => {
  const { pending } = useFormStatus();
  if (!pending) {
    return null;
  }
  return (
    <span className="text-xs text-slate-400" aria-live="polite">
      {label ?? 'Saving...'}
    </span>
  );
};

const useRefreshOnSuccess = (state: ActionState) => {
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);
};

export function CompanyForm({ action }: { action: ActionHandler }) {
  const [state, formAction] = useFormState(action, initialState);
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
    >
      <h2 className="text-lg font-medium">Create company</h2>
      <input
        name="companyName"
        placeholder="Acme Corp"
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Add company
        </button>
        <PendingText label="Adding..." />
      </div>
      <StatusMessage state={state} />
    </form>
  );
}

export function OrganizationForm({ action }: { action: ActionHandler }) {
  const [state, formAction] = useFormState(action, initialState);
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
    >
      <h2 className="text-lg font-medium">Create organization</h2>
      <input
        name="organizationName"
        placeholder="Operations Team"
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Add organization
        </button>
        <PendingText label="Adding..." />
      </div>
      <StatusMessage state={state} />
    </form>
  );
}

export function UserAccessForm({
  action,
  children,
}: {
  action: ActionHandler;
  children: ReactNode;
}) {
  const [state, formAction] = useFormState(action, initialState);
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]"
    >
      {children}
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
        >
          Save
        </button>
        <PendingText />
      </div>
      <div className="md:col-span-4">
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

export function DashboardCreateForm({
  action,
  children,
}: {
  action: ActionHandler;
  children: ReactNode;
}) {
  const [state, formAction] = useFormState(action, initialState);
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2"
    >
      {children}
      <div className="flex items-center gap-2 md:col-span-2">
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Create dashboard
        </button>
        <PendingText label="Creating..." />
      </div>
      <div className="md:col-span-2">
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

export function DashboardEditForm({
  action,
  children,
}: {
  action: ActionHandler;
  children: ReactNode;
}) {
  const [state, formAction] = useFormState(action, initialState);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="contents">
      {children}
      <div className="flex items-end gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
        >
          Save
        </button>
        <button
          type="submit"
          name="intent"
          value="delete"
          className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
        >
          Delete
        </button>
        <PendingText />
      </div>
      <div className="md:col-span-6">
        <StatusMessage state={state} />
      </div>
    </form>
  );
}
