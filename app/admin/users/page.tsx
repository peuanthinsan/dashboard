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
import { buildRegisterSchema } from 'app/lib/site-auth-schemas';
import { getSiteCopy } from 'app/site-i18n-copy';

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
    const password = (formData.get('userPassword') as string) ?? '';
    const isAdmin = formData.get('isAdmin') === 'on';
    const pageLang = await getDashboardLang();
    const authSchema = buildRegisterSchema(getSiteCopy(pageLang).validation);
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      return {
        status: 'error',
        message: parsed.error.issues[0]?.message ?? 'Enter valid user details.',
      };
    }
    const existing = await getUser(parsed.data.email);
    if (existing.length > 0) {
      return { status: 'error', message: 'User already exists.' };
    }
    try {
      await createUserWithRole({
        email: parsed.data.email,
        password: parsed.data.password,
        isAdmin,
      });
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
    if (!Number.isSafeInteger(userId) || userId <= 0) {
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
    const password = (formData.get('userPassword') as string) ?? '';
    const companyValues = formData.getAll('companyIds') as string[];
    const organizationValues = formData.getAll('organizationIds') as string[];
    const isAdmin = formData.get('isAdmin') === 'on';
    const showBothCompanyAndFleet = formData.get('showBothCompanyAndFleet') === 'on';

    if (adminUser.id === userId && !isAdmin) {
      return { status: 'error', message: 'You cannot remove your own admin access.' };
    }
    const pageLang = await getDashboardLang();
    const authSchema = buildRegisterSchema(getSiteCopy(pageLang).validation);
    const parsedAuth = password
      ? authSchema.safeParse({ email, password })
      : authSchema.shape.email.safeParse(email);
    if (!parsedAuth.success) {
      return {
        status: 'error',
        message: parsedAuth.error.issues[0]?.message ?? 'Enter valid user details.',
      };
    }
    const validatedEmail =
      typeof parsedAuth.data === 'string' ? parsedAuth.data : parsedAuth.data.email;

    const existingEmailUser = await getUser(validatedEmail);
    if (existingEmailUser.some((candidate) => candidate.id !== userId)) {
      return { status: 'error', message: 'Another user already uses that email.' };
    }

    const [availableCompanies, availableOrganizations] = await Promise.all([
      getCompanies(),
      getOrganizations(),
    ]);
    const allowedCompanyIds = new Set(availableCompanies.map((company) => company.id));
    const allowedOrganizationIds = new Set(
      availableOrganizations.map((organization) => organization.id),
    );
    const companyIds = companyValues.map(Number);
    const organizationIds = organizationValues.map(Number);
    if (
      companyIds.some((id) => !Number.isSafeInteger(id) || !allowedCompanyIds.has(id)) ||
      organizationIds.some((id) => !Number.isSafeInteger(id) || !allowedOrganizationIds.has(id))
    ) {
      return { status: 'error', message: 'One or more access assignments are invalid.' };
    }

    try {
      await updateUserProfile({
        id: userId,
        email: validatedEmail,
        password: password ? password : null,
      });
      await updateUserAssignments(userId, {
        companyIds,
        organizationIds,
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

  async function bulkCreateUsersAction(emails: string[], password: string) {
    'use server';
    await requireAdmin();
    const pageLang = await getDashboardLang();
    const authSchema = buildRegisterSchema(getSiteCopy(pageLang).validation);
    const normalizedEmails = emails.map((email) => email.trim()).filter(Boolean);
    if (normalizedEmails.length === 0) {
      return { created: 0, skipped: 0, error: 'Enter at least one email address.' };
    }
    for (const email of normalizedEmails) {
      const parsed = authSchema.safeParse({ email, password });
      if (!parsed.success) {
        return {
          created: 0,
          skipped: 0,
          error: parsed.error.issues[0]?.message ?? `Invalid account: ${email}`,
        };
      }
    }
    return bulkCreateUsers(normalizedEmails, password);
  }

  async function bulkSetAdminAction(userIds: number[], isAdmin: boolean) {
    'use server';
    const adminUser = await requireAdmin();
    const safeIds = isAdmin ? userIds : userIds.filter((id) => id !== adminUser.id);
    return bulkSetAdmin(safeIds, isAdmin);
  }

  async function bulkDeleteUsersAction(userIds: number[]) {
    'use server';
    const adminUser = await requireAdmin();
    return bulkDeleteUsers(userIds.filter((id) => id !== adminUser.id));
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
        bulkCreateAction={bulkCreateUsersAction}
        bulkAssignCompanyAction={bulkAssignUsersToCompany}
        bulkAssignOrgAction={bulkAssignUsersToOrganization}
        bulkSetAdminAction={bulkSetAdminAction}
        bulkDeleteAction={bulkDeleteUsersAction}
      />
    </AdminShell>
  );
}
