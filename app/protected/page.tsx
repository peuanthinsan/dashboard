import Link from 'next/link';
import { auth, signOut } from 'app/auth';
import { getUser } from 'app/db';

export default async function ProtectedPage() {
  let session = await auth();
  let user = session?.user?.email ? await getUser(session.user.email) : [];
  let isAdmin = user.length > 0 && user[0].isAdmin;

  return (
    <div className="flex h-screen bg-black">
      <div className="w-screen h-screen flex flex-col space-y-5 justify-center items-center text-white">
        You are logged in as {session?.user?.email}
        <Link
          href="/dashboards"
          className="rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:border-white"
        >
          View dashboards
        </Link>
        {isAdmin ? (
          <Link
            href="/admin"
            className="rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:border-white"
          >
            Go to administration
          </Link>
        ) : null}
        <SignOut />
      </div>
    </div>
  );
}

function SignOut() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      <button type="submit">Sign out</button>
    </form>
  );
}
