import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getUser } from 'app/db';

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
