import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import {
  createCompany,
  createDashboard,
  createOrganization,
  createUserWithRole,
  deleteCompany,
  deleteDashboard,
  deleteOrganization,
  deleteUser,
  getCompanies,
  getDashboards,
  getOrganizations,
  getUser,
  getUsers,
  updateCompany,
  updateDashboard,
  updateOrganization,
  updateUserAssignments,
  updateUserProfile,
} from 'app/db';
import AdminPageClient from './AdminPageClient';

type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const parseSheetLink = (sheetUrl: string) => {
  const trimmed = sheetUrl.trim();
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  return {
    sheetId: idMatch?.[1] ?? null,
    sheetGid: gidMatch?.[1] ?? '0',
  };
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }
  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    redirect('/dashboard');
  }
  return currentUser[0];
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    redirect('/dashboard');
  }

  const [users, companies, organizations, dashboards] = await Promise.all([
    getUsers(),
    getCompanies(),
    getOrganizations(),
    getDashboards(),
  ]);

  async function addCompanyAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('companyName') as string)?.trim();
    if (!name) {
      return { status: 'error', message: 'Enter a company name.' };
    }
    try {
      await createCompany(name);
      revalidatePath('/admin');
      return { status: 'success', message: 'Company created.' };
    } catch (error) {
      console.error('Failed to create company', error);
      return { status: 'error', message: 'Unable to create company.' };
    }
  }

  async function manageCompanyAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const companyId = Number(formData.get('companyId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!companyId) {
      return { status: 'error', message: 'Missing company selection.' };
    }
    try {
      if (intent === 'delete') {
        await deleteCompany(companyId);
        revalidatePath('/admin');
        return { status: 'success', message: 'Company deleted.' };
      }
      const name = (formData.get('companyName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter a company name.' };
      }
      await updateCompany(companyId, name);
      revalidatePath('/admin');
      return { status: 'success', message: 'Company updated.' };
    } catch (error) {
      console.error('Failed to update company', error);
      return { status: 'error', message: 'Unable to update company.' };
    }
  }

  async function addOrganizationAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('organizationName') as string)?.trim();
    if (!name) {
      return { status: 'error', message: 'Enter an organization name.' };
    }
    try {
      await createOrganization(name);
      revalidatePath('/admin');
      return { status: 'success', message: 'Organization created.' };
    } catch (error) {
      console.error('Failed to create organization', error);
      return { status: 'error', message: 'Unable to create organization.' };
    }
  }

  async function manageOrganizationAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const organizationId = Number(formData.get('organizationId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!organizationId) {
      return { status: 'error', message: 'Missing organization selection.' };
    }
    try {
      if (intent === 'delete') {
        await deleteOrganization(organizationId);
        revalidatePath('/admin');
        return { status: 'success', message: 'Organization deleted.' };
      }
      const name = (formData.get('organizationName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter an organization name.' };
      }
      await updateOrganization(organizationId, name);
      revalidatePath('/admin');
      return { status: 'success', message: 'Organization updated.' };
    } catch (error) {
      console.error('Failed to update organization', error);
      return { status: 'error', message: 'Unable to update organization.' };
    }
  }

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
      revalidatePath('/admin');
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
        revalidatePath('/admin');
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
        organizationIds: organizationValues.map(Number).filter((value) => !Number.isNaN(value)),
        isAdmin,
      });
      revalidatePath('/admin');
      return { status: 'success', message: 'User updated.' };
    } catch (error) {
      console.error('Failed to update user', error);
      return { status: 'error', message: 'Unable to update user.' };
    }
  }

  async function addDashboardAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim();
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    if (!name || !template || !sheetUrl || !companyId) {
      return { status: 'error', message: 'Fill in all required dashboard fields.' };
    }
    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      return { status: 'error', message: 'Enter a valid Google Sheet link.' };
    }
    try {
      await createDashboard({
        name,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId: organizationValue ? Number(organizationValue) : null,
      });
      revalidatePath('/admin');
      return { status: 'success', message: 'Dashboard created.' };
    } catch (error) {
      console.error('Failed to create dashboard', error);
      return { status: 'error', message: 'Unable to create dashboard.' };
    }
  }

  async function manageDashboardAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const dashboardId = Number(formData.get('dashboardId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!dashboardId) {
      return { status: 'error', message: 'Missing dashboard selection.' };
    }
    if (intent === 'delete') {
      try {
        await deleteDashboard(dashboardId);
        revalidatePath('/admin');
        return { status: 'success', message: 'Dashboard deleted.' };
      } catch (error) {
        console.error('Failed to delete dashboard', error);
        return { status: 'error', message: 'Unable to delete dashboard.' };
      }
    }

    const name = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim();
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    if (!name || !template || !sheetUrl || !companyId) {
      return { status: 'error', message: 'Fill in all required dashboard fields.' };
    }
    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      return { status: 'error', message: 'Enter a valid Google Sheet link.' };
    }
    try {
      await updateDashboard({
        id: dashboardId,
        name,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId: organizationValue ? Number(organizationValue) : null,
      });
      revalidatePath('/admin');
      return { status: 'success', message: 'Dashboard updated.' };
    } catch (error) {
      console.error('Failed to update dashboard', error);
      return { status: 'error', message: 'Unable to update dashboard.' };
    }
  }

  return (
    <AdminPageClient
      users={users}
      companies={companies}
      organizations={organizations}
      dashboards={dashboards}
      addCompanyAction={addCompanyAction}
      manageCompanyAction={manageCompanyAction}
      addOrganizationAction={addOrganizationAction}
      manageOrganizationAction={manageOrganizationAction}
      addUserAction={addUserAction}
      manageUserAction={manageUserAction}
      addDashboardAction={addDashboardAction}
      manageDashboardAction={manageDashboardAction}
    />
  );
}
