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
import AdminShell from '../AdminShell';
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

    const companyIds = companyValues.map(Number).filter((value) => !Number.isNaN(value));
    const selectedCompanySet = new Set(companyIds);
    const requestedOrganizationIds = organizationValues
      .map(Number)
      .filter((value) => !Number.isNaN(value));
    const allOrganizations = await getOrganizations();
    const organizationIds = requestedOrganizationIds.filter((organizationId) => {
      const organization = allOrganizations.find((item) => item.id === organizationId);
      return !!organization?.companyId && selectedCompanySet.has(organization.companyId);
    });

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
        companyIds,
        organizationIds,
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
    <AdminShell
      backHref="/admin"
      backLabel="Back to admin overview"
      eyebrow="Administration"
      title="Users"
      description="Assign users to companies and fleets and manage admin access."
    >
      <UsersClient
        users={users}
        companies={companies}
        organizations={organizations}
        addUserAction={addUserAction}
        manageUserAction={manageUserAction}
      />
    </AdminShell>
  );
}
