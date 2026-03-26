import Link from 'next/link';

import { getDashboardLang } from 'app/dashboard/i18n';
import { getSiteCopy } from 'app/site-i18n-copy';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import { btnPrimary, btnSecondary, heading2, textSecondary } from 'app/ui/design-tokens';

export default async function NotFound() {
  const lang = await getDashboardLang();
  const copy = getSiteCopy(lang);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 outline-none dark:bg-zinc-950"
    >
      <div className="mb-8">
        <SongdeeLogo height={32} />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-zinc-200 dark:text-zinc-700">404</h1>
        <h2 className={`mt-4 ${heading2}`}>{copy.notFound.title}</h2>
        <p className={`mt-2 ${textSecondary}`}>{copy.notFound.description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={btnPrimary}>
            {copy.notFound.goHome}
          </Link>
          <Link href="/login" className={btnSecondary}>
            {copy.notFound.signIn}
          </Link>
        </div>
      </div>
    </main>
  );
}
