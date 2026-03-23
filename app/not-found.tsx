import Link from 'next/link';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mb-8">
        <SongdeeLogo height={32} />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-zinc-200 dark:text-zinc-700">404</h1>
        <h2 className={`mt-4 ${heading2}`}>Page not found</h2>
        <p className={`mt-2 ${textSecondary}`}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={btnPrimary}>
            Go home
          </Link>
          <Link href="/login" className={btnSecondary}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
