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
    // True when the URL didn't include a gid — admin UIs can warn rather than silently use tab 0.
    gidInferred: !gidMatch,
  };
};

/** Format guards for sheet ID / gid values that get embedded into outbound URLs. */
export const SHEET_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;
export const SHEET_GID_PATTERN = /^\d{1,12}$/;
export const isValidSheetId = (id: string) => SHEET_ID_PATTERN.test(id);
export const isValidSheetGid = (gid: string) => SHEET_GID_PATTERN.test(gid);

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
