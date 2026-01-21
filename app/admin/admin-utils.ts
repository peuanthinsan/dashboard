import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getUser } from 'app/db';

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
