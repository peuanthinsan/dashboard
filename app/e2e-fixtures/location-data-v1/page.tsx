import { notFound } from 'next/navigation';
import E2eLocationDataV1Client from './E2eLocationDataV1Client';

export const dynamic = 'force-dynamic';

type E2eLocationDataV1FixturePageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function E2eLocationDataV1FixturePage({ searchParams }: E2eLocationDataV1FixturePageProps) {
  if (process.env.ALLOW_E2E_FIXTURES !== 'true') {
    notFound();
  }

  const { mode } = await searchParams;
  return <E2eLocationDataV1Client mode={mode === 'single-vehicle' ? 'single-vehicle' : 'fleet'} />;
}
