'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
  getUser,
  updateCompany,
  updateDashboard,
  updateOrganization,
  updateUserAssignments,
  updateUserProfile,
} from 'app/db';
import { ActionState } from './types';

const INVALID_INPUT_MESSAGE = 'Please provide all required fields.';
const UNAUTHORIZED_MESSAGE = 'You do not have permission to perform this action.';

const parseSheetLink = (sheetUrl: string) => {
  const trimmed = sheetUrl.trim();
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  return {
    sheetId: idMatch?.[1] ?? null,
    sheetGid: gidMatch?.[1] ?? '0',
  };
};

const requireAdmin = async (): Promise<ActionState | { id: number }> => {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }
  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    return { status: 'error', message: UNAUTHORIZED_MESSAGE };
  }
  return { id: currentUser[0].id };
};

const handleAdminResult = (result: ActionState | { id: number }): ActionState | null => {
  if ('status' in result) {
    return result;
  }
  return null;
};

export async function addCompany(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const name = (formData.get('companyName') as string)?.trim();
  if (!name) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await createCompany(name);
    revalidatePath('/admin');
    return { status: 'success', message: 'Company created.' };
  } catch {
    return { status: 'error', message: 'Unable to create company.' };
  }
}

export async function saveCompany(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const companyId = Number(formData.get('companyId'));
  const name = (formData.get('companyName') as string)?.trim();
  if (!companyId || !name) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await updateCompany(companyId, name);
    revalidatePath('/admin');
    return { status: 'success', message: 'Company updated.' };
  } catch {
    return { status: 'error', message: 'Unable to update company.' };
  }
}

export async function removeCompany(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const companyId = Number(formData.get('companyId'));
  if (!companyId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await deleteCompany(companyId);
    revalidatePath('/admin');
    return { status: 'success', message: 'Company deleted.' };
  } catch {
    return { status: 'error', message: 'Unable to delete company.' };
  }
}

export async function addOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const name = (formData.get('organizationName') as string)?.trim();
  if (!name) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await createOrganization(name);
    revalidatePath('/admin');
    return { status: 'success', message: 'Organization created.' };
  } catch {
    return { status: 'error', message: 'Unable to create organization.' };
  }
}

export async function saveOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const organizationId = Number(formData.get('organizationId'));
  const name = (formData.get('organizationName') as string)?.trim();
  if (!organizationId || !name) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await updateOrganization(organizationId, name);
    revalidatePath('/admin');
    return { status: 'success', message: 'Organization updated.' };
  } catch {
    return { status: 'error', message: 'Unable to update organization.' };
  }
}

export async function removeOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const organizationId = Number(formData.get('organizationId'));
  if (!organizationId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await deleteOrganization(organizationId);
    revalidatePath('/admin');
    return { status: 'success', message: 'Organization deleted.' };
  } catch {
    return { status: 'error', message: 'Unable to delete organization.' };
  }
}

export async function addUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const email = (formData.get('userEmail') as string)?.trim();
  const password = (formData.get('userPassword') as string)?.trim();
  const isAdmin = formData.get('isAdmin') === 'on';
  if (!email || !password) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  const existing = await getUser(email);
  if (existing.length > 0) {
    return { status: 'error', message: 'A user with that email already exists.' };
  }
  try {
    await createUserWithRole({ email, password, isAdmin });
    revalidatePath('/admin');
    return { status: 'success', message: 'User created.' };
  } catch {
    return { status: 'error', message: 'Unable to create user.' };
  }
}

export async function updateUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const userId = Number(formData.get('userId'));
  const email = (formData.get('userEmail') as string)?.trim();
  const password = (formData.get('userPassword') as string)?.trim();
  const companyValues = formData.getAll('companyIds') as string[];
  const organizationValues = formData.getAll('organizationIds') as string[];
  const isAdmin = formData.get('isAdmin') === 'on';
  if (!email || !userId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  if ('id' in adminResult && adminResult.id === userId && !isAdmin) {
    return { status: 'error', message: 'You cannot remove your own admin access.' };
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
  } catch {
    return { status: 'error', message: 'Unable to update user.' };
  }
}

export async function removeUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const userId = Number(formData.get('userId'));
  if (!userId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  if ('id' in adminResult && adminResult.id === userId) {
    return { status: 'error', message: 'You cannot delete your own account.' };
  }
  try {
    await deleteUser(userId);
    revalidatePath('/admin');
    return { status: 'success', message: 'User deleted.' };
  } catch {
    return { status: 'error', message: 'Unable to delete user.' };
  }
}

export async function addDashboard(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const name = (formData.get('dashboardName') as string)?.trim();
  const template = (formData.get('template') as string)?.trim();
  const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
  const companyId = Number(formData.get('companyId'));
  const organizationValue = (formData.get('organizationId') as string) ?? '';
  if (!name || !template || !sheetUrl || !companyId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
  if (!sheetId) {
    return { status: 'error', message: 'Please provide a valid Google Sheet link.' };
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
  } catch {
    return { status: 'error', message: 'Unable to create dashboard.' };
  }
}

export async function saveDashboard(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const dashboardId = Number(formData.get('dashboardId'));
  const name = (formData.get('dashboardName') as string)?.trim();
  const template = (formData.get('template') as string)?.trim();
  const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
  const companyId = Number(formData.get('companyId'));
  const organizationValue = (formData.get('organizationId') as string) ?? '';
  if (!dashboardId || !name || !template || !sheetUrl || !companyId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
  if (!sheetId) {
    return { status: 'error', message: 'Please provide a valid Google Sheet link.' };
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
  } catch {
    return { status: 'error', message: 'Unable to update dashboard.' };
  }
}

export async function removeDashboard(_: ActionState, formData: FormData): Promise<ActionState> {
  const adminResult = await requireAdmin();
  const adminError = handleAdminResult(adminResult);
  if (adminError) {
    return adminError;
  }
  const dashboardId = Number(formData.get('dashboardId'));
  if (!dashboardId) {
    return { status: 'error', message: INVALID_INPUT_MESSAGE };
  }
  try {
    await deleteDashboard(dashboardId);
    revalidatePath('/admin');
    return { status: 'success', message: 'Dashboard deleted.' };
  } catch {
    return { status: 'error', message: 'Unable to delete dashboard.' };
  }
}
