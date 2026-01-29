import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createUserWithRole,
  deleteUser,
  getCompanies,
  getOrganizations,
  getUser,
  getUsers,
  updateUserAssignments,
  updateUserProfile,
} from 'app/db';
import AdminNav from '../AdminNav';
import { requireAdmin } from '../admin-utils';
import UsersClient from './UsersClient';
import type { ActionState } from '../types';

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, companies, organizations] = await Promise.all([
    getUsers(),
    getCompanies(),
    getOrganizations(),
  ]);

  async function addUserAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const email = (formData.get('userEmail') as string)?.trim();
    const password = (formData.get('userPassword') as string)?.trim();
    const isAdmin = formData.get('isAdmin') === 'on';
    if (!email || !password) {
      return { status: 'error', message: 'Email and password are required.' };
    }
    const existing = await getUser(email);
    if (existing.length > 0) {
      return { status: 'error', message: 'User already exists.' };
    }
    try {
      await createUserWithRole({ email, password, isAdmin });
      revalidatePath('/admin/users');
      return { status: 'success', message: 'User created.' };
    } catch (error) {
      console.error('Failed to create user', error);
      return { status: 'error', message: 'Unable to create user.' };
    }
  }

  async function manageUserAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    const adminUser = await requireAdmin();
    const userId = Number(formData.get('userId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!userId) {
      return { status: 'error', message: 'Missing user selection.' };
    }
    if (intent === 'delete') {
      if (adminUser.id === userId) {
        return { status: 'error', message: 'You cannot delete your own account.' };
      }
      try {
        await deleteUser(userId);
        revalidatePath('/admin/users');
        return { status: 'success', message: 'User deleted.' };
      } catch (error) {
        console.error('Failed to delete user', error);
        return { status: 'error', message: 'Unable to delete user.' };
      }
    }

    const email = (formData.get('userEmail') as string)?.trim();
    const password = (formData.get('userPassword') as string)?.trim();
    const companyValues = formData.getAll('companyIds') as string[];
    const organizationValues = formData.getAll('organizationIds') as string[];
    const isAdmin = formData.get('isAdmin') === 'on';

    if (adminUser.id === userId && !isAdmin) {
      return { status: 'error', message: 'You cannot remove your own admin access.' };
    }
    if (!email) {
      return { status: 'error', message: 'Email is required.' };
    }

    try {
      await updateUserProfile({
        id: userId,
        email,
        password: password ? password : null,
      });
      await updateUserAssignments(userId, {
        companyIds: companyValues.map(Number).filter((value) => !Number.isNaN(value)),
        organizationIds: organizationValues
          .map(Number)
          .filter((value) => !Number.isNaN(value)),
        isAdmin,
      });
      revalidatePath('/admin/users');
      return { status: 'success', message: 'User updated.' };
    } catch (error) {
      console.error('Failed to update user', error);
      return { status: 'error', message: 'Unable to update user.' };
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin overview
          </Link>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Administration
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Users</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Assign users to companies and organizations and manage admin access.
            </p>
          </div>
          <AdminNav />
        </header>

        <UsersClient
          users={users}
          companies={companies}
          organizations={organizations}
          addUserAction={addUserAction}
          manageUserAction={manageUserAction}
        />
      </div>
    </div>
  );
}
