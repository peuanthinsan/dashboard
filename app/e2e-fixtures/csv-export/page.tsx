import { notFound } from 'next/navigation';
import E2eCsvExportClient from './E2eCsvExportClient';

/** Env must be evaluated at request time, not baked in at build. */
export const dynamic = 'force-dynamic';

export default function E2eCsvExportFixturePage() {
  if (process.env.ALLOW_E2E_FIXTURES !== 'true') {
    notFound();
  }
  return <E2eCsvExportClient />;
}
