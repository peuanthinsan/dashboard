import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import { getUser } from 'app/db';

export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const ADMIN_PATHS = ['/admin', '/admin/companies', '/admin/users', '/admin/dashboards'];

export const parseSheetLink = (sheetUrl: string) => {
  const trimmed = sheetUrl.trim();
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  return {
    sheetId: idMatch?.[1] ?? null,
    sheetGid: gidMatch?.[1] ?? '0',
  };
};

export async function requireAdmin() {
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

export function revalidateAdminPaths() {
  ADMIN_PATHS.forEach((path) => revalidatePath(path));
}
