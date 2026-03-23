export const dynamic = 'force-dynamic';

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
import {
  bulkCreateUsers,
  bulkAssignUsersToCompany,
  bulkAssignUsersToOrganization,
  bulkSetAdmin,
  bulkDeleteUsers,
} from 'app/db-bulk';
import AdminShell from '../AdminShell';
import { requireAdmin } from '../admin-utils';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from '../i18n-copy';
import UsersClient from './UsersClient';
import type { ActionState } from '../types';

export default async function AdminUsersPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);

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
    const showBothCompanyAndFleet = formData.get('showBothCompanyAndFleet') === 'on';

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
        showBothCompanyAndFleet,
      });
      revalidatePath('/admin/users');
      return { status: 'success', message: 'User updated.' };
    } catch (error) {
      console.error('Failed to update user', error);
      return { status: 'error', message: 'Unable to update user.' };
    }
  }

  return (
    <AdminShell
      backHref="/admin"
      backLabel={copy.backToAdminOverview}
      eyebrow={copy.administration}
      title={copy.users}
      description={copy.assignUsersToCompaniesAndFleets}
      workflowHint={copy.workflowUsers}
      lang={lang}
    >
      <UsersClient
        users={users}
        companies={companies}
        organizations={organizations}
        adminCopy={{
          showBothCompanyAndFleet: copy.showBothCompanyAndFleet,
          showBothCompanyAndFleetHint: copy.showBothCompanyAndFleetHint,
        }}
        addUserAction={addUserAction}
        manageUserAction={manageUserAction}
        bulkCreateAction={bulkCreateUsers}
        bulkAssignCompanyAction={bulkAssignUsersToCompany}
        bulkAssignOrgAction={bulkAssignUsersToOrganization}
        bulkSetAdminAction={bulkSetAdmin}
        bulkDeleteAction={bulkDeleteUsers}
      />
    </AdminShell>
  );
}
