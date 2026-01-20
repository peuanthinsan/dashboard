'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import {
  createCompany,
  createDashboard,
  createOrganization,
  deleteDashboard,
  getUser,
  updateDashboard,
  updateUserAssignments,
} from 'app/db';

export type ActionState = {
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

const formatError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

const ensureAdmin = async () => {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }
  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    redirect('/protected');
  }
  return currentUser[0];
};

export async function addCompany(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await ensureAdmin();
  const name = (formData.get('companyName') as string)?.trim();
  if (!name) {
    return { status: 'error', message: 'Company name is required.' };
  }
  try {
    await createCompany(name);
    revalidatePath('/admin');
    return { status: 'success', message: `Company "${name}" created.` };
  } catch (error) {
    return { status: 'error', message: formatError(error, 'Unable to create company.') };
  }
}

export async function addOrganization(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await ensureAdmin();
  const name = (formData.get('organizationName') as string)?.trim();
  if (!name) {
    return { status: 'error', message: 'Organization name is required.' };
  }
  try {
    await createOrganization(name);
    revalidatePath('/admin');
    return { status: 'success', message: `Organization "${name}" created.` };
  } catch (error) {
    return { status: 'error', message: formatError(error, 'Unable to create organization.') };
  }
}

export async function updateUser(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await ensureAdmin();
  const userId = Number(formData.get('userId'));
  if (!userId) {
    return { status: 'error', message: 'User is missing.' };
  }
  const companyValues = formData.getAll('companyIds') as string[];
  const organizationValues = formData.getAll('organizationIds') as string[];
  const isAdmin = formData.get('isAdmin') === 'on';
  if (currentUser.id === userId && !isAdmin) {
    return { status: 'error', message: 'You cannot remove your own admin access.' };
  }
  try {
    await updateUserAssignments(userId, {
      companyIds: companyValues.map(Number).filter((value) => !Number.isNaN(value)),
      organizationIds: organizationValues.map(Number).filter((value) => !Number.isNaN(value)),
      isAdmin,
    });
    revalidatePath('/admin');
    return { status: 'success', message: 'User access updated.' };
  } catch (error) {
    return { status: 'error', message: formatError(error, 'Unable to update user access.') };
  }
}

export async function addDashboard(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await ensureAdmin();
  const name = (formData.get('dashboardName') as string)?.trim();
  const template = (formData.get('template') as string)?.trim();
  const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
  const companyId = Number(formData.get('companyId'));
  const organizationValue = (formData.get('organizationId') as string) ?? '';
  if (!name || !template || !sheetUrl || !companyId) {
    return { status: 'error', message: 'All required dashboard fields must be filled in.' };
  }
  const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
  if (!sheetId) {
    return { status: 'error', message: 'Google Sheet link is invalid.' };
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
    return { status: 'success', message: `Dashboard "${name}" created.` };
  } catch (error) {
    return { status: 'error', message: formatError(error, 'Unable to create dashboard.') };
  }
}

export async function updateDashboardEntry(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await ensureAdmin();
  const intent = (formData.get('intent') as string) ?? 'save';
  const dashboardId = Number(formData.get('dashboardId'));
  if (!dashboardId) {
    return { status: 'error', message: 'Dashboard is missing.' };
  }
  if (intent === 'delete') {
    try {
      await deleteDashboard(dashboardId);
      revalidatePath('/admin');
      return { status: 'success', message: 'Dashboard deleted.' };
    } catch (error) {
      return { status: 'error', message: formatError(error, 'Unable to delete dashboard.') };
    }
  }

  const name = (formData.get('dashboardName') as string)?.trim();
  const template = (formData.get('template') as string)?.trim();
  const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
  const companyId = Number(formData.get('companyId'));
  const organizationValue = (formData.get('organizationId') as string) ?? '';
  if (!name || !template || !sheetUrl || !companyId) {
    return { status: 'error', message: 'All required dashboard fields must be filled in.' };
  }
  const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
  if (!sheetId) {
    return { status: 'error', message: 'Google Sheet link is invalid.' };
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
    return { status: 'error', message: formatError(error, 'Unable to update dashboard.') };
  }
}
