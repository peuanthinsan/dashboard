import { notFound } from 'next/navigation';
import E2eLocationDataV1Client from './E2eLocationDataV1Client';

export const dynamic = 'force-dynamic';

export default function E2eLocationDataV1FixturePage() {
  if (process.env.ALLOW_E2E_FIXTURES !== 'true') {
    notFound();
  }
  return <E2eLocationDataV1Client />;
}
