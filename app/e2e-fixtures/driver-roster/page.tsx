import { notFound } from 'next/navigation';
import RosterPreview from './RosterPreview';

export const dynamic = 'force-dynamic';
export default function DriverRosterPreview() {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_E2E_FIXTURES !== 'true') notFound();
  return <RosterPreview />;
}
