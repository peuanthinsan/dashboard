'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import {
  INITIAL_STATE,
  StatusMessage,
  UserRow,
  useRefreshOnSuccess,
  type ActionState,
  type Company,
  type FormAction,
  type Organization,
  type User,
} from '../components/AdminShared';

type AdminUsersClientProps = {
  users: User[];
  companies: Company[];
  organizations: Organization[];
  addUserAction: FormAction;
  manageUserAction: FormAction;
};

export default function AdminUsersClient({
  users,
  companies,
  organizations,
  addUserAction,
  manageUserAction,
}: AdminUsersClientProps) {
  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);

  useRefreshOnSuccess(userCreateState);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin home
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Users</h1>
            <p className="text-sm text-slate-300">
              Invite admins and assign access to companies and organizations.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm text-slate-300">
            <Link href="/admin/companies" className="hover:text-white">
              Companies
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin/users" className="text-white">
              Users
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin/dashboards" className="hover:text-white">
              Dashboards
            </Link>
          </nav>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">Create a user</h2>
          <form
            action={userCreateAction}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1fr_auto]"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Email</label>
              <input
                name="userEmail"
                placeholder="user@acme.com"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Temporary password</label>
              <input
                type="password"
                name="userPassword"
                placeholder="Create a password"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  name="isAdmin"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                Admin access
              </label>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Create user
              </button>
            </div>
            <StatusMessage state={userCreateState as ActionState} />
          </form>

          <div className="grid gap-4">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                companies={companies}
                organizations={organizations}
                action={manageUserAction}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
