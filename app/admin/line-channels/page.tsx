export const dynamic = 'force-dynamic';

import { db } from 'app/db';
import { lineChannels, organizations } from 'app/db-schema';
import { requireAdmin } from '../admin-utils';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from '../i18n-copy';
import AdminShell from '../AdminShell';
import { LineChannelsClient } from './LineChannelsClient';
import {
  createLineChannel,
  updateLineChannel,
  deleteLineChannel,
  testLineChannel,
} from './lineChannelActions';

export default async function AdminLineChannelsPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);

  const orgsRows = await db.select().from(organizations).orderBy(organizations.name);
  const channelRows = await db.select({
    id: lineChannels.id,
    organizationId: lineChannels.organizationId,
    name: lineChannels.name,
    groupId: lineChannels.groupId,
    createdAt: lineChannels.createdAt,
  }).from(lineChannels).orderBy(lineChannels.organizationId, lineChannels.name);

  return (
    <AdminShell
      backHref="/admin"
      backLabel={copy.backToAdminOverview}
      eyebrow={copy.adminTools}
      title="LINE channels"
      description="Manage LINE Messaging channels per fleet. Access tokens are stored encrypted."
      lang={lang}
    >
      <LineChannelsClient
        organizations={orgsRows.map((o) => ({ id: o.id, name: o.name }))}
        channels={channelRows}
        createAction={createLineChannel}
        updateAction={updateLineChannel}
        deleteAction={deleteLineChannel}
        testAction={testLineChannel}
      />
    </AdminShell>
  );
}
