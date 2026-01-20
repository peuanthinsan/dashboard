import { redirect } from 'next/navigation';
import { auth } from 'app/auth';

export default async function Page() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  redirect('/dashboard');
}
