'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from 'app/db';
import { lineChannels } from 'app/db-schema';
import { encryptLineToken } from 'app/lib/lineTokenCrypto';
import { requireAdmin } from 'app/admin/admin-utils';
import { sendLinePushMessage } from 'app/lib/lineMessagingApi';
import { getLineChannelById } from 'app/db';
import { z } from 'zod';

const Create = z.object({
  organizationId: z.number().int().positive(),
  name: z.string().min(1).max(64),
  groupId: z.string().min(1).max(64),
  accessToken: z.string().min(8).max(2048),
});

const Update = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(64),
  groupId: z.string().min(1).max(64),
  accessToken: z.string().min(0).max(2048),
});

export type LineChannelActionState =
  | { status: 'idle' }
  | { status: 'success'; message: string; id?: number }
  | { status: 'error'; message: string };

export async function createLineChannel(
  _prev: LineChannelActionState,
  formData: FormData,
): Promise<LineChannelActionState> {
  await requireAdmin();
  const parsed = Create.safeParse({
    organizationId: Number(formData.get('organizationId')),
    name: String(formData.get('name') ?? '').trim(),
    groupId: String(formData.get('groupId') ?? '').trim(),
    accessToken: String(formData.get('accessToken') ?? '').trim(),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input.' };

  try {
    const [inserted] = await db.insert(lineChannels).values({
      organizationId: parsed.data.organizationId,
      name: parsed.data.name,
      groupId: parsed.data.groupId,
      accessToken: encryptLineToken(parsed.data.accessToken) as unknown as string,
    }).returning({ id: lineChannels.id });
    revalidatePath('/admin/line-channels');
    return { status: 'success', message: 'Channel created.', id: inserted.id };
  } catch (err) {
    console.error('createLineChannel failed', err);
    return { status: 'error', message: 'Failed to create channel.' };
  }
}

export async function updateLineChannel(
  _prev: LineChannelActionState,
  formData: FormData,
): Promise<LineChannelActionState> {
  await requireAdmin();
  const parsed = Update.safeParse({
    id: Number(formData.get('id')),
    name: String(formData.get('name') ?? '').trim(),
    groupId: String(formData.get('groupId') ?? '').trim(),
    accessToken: String(formData.get('accessToken') ?? '').trim(),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input.' };

  try {
    const values: Record<string, unknown> = {
      name: parsed.data.name,
      groupId: parsed.data.groupId,
      updatedAt: new Date(),
    };
    if (parsed.data.accessToken.length > 0) {
      values.accessToken = encryptLineToken(parsed.data.accessToken);
    }
    await db.update(lineChannels).set(values).where(eq(lineChannels.id, parsed.data.id));
    revalidatePath('/admin/line-channels');
    return { status: 'success', message: 'Channel updated.', id: parsed.data.id };
  } catch (err) {
    console.error('updateLineChannel failed', err);
    return { status: 'error', message: 'Failed to update channel.' };
  }
}

export async function deleteLineChannel(
  _prev: LineChannelActionState,
  formData: FormData,
): Promise<LineChannelActionState> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return { status: 'error', message: 'Missing id.' };
  try {
    await db.delete(lineChannels).where(eq(lineChannels.id, id));
    revalidatePath('/admin/line-channels');
    return { status: 'success', message: 'Channel deleted.' };
  } catch (err) {
    console.error('deleteLineChannel failed', err);
    return { status: 'error', message: 'Failed to delete channel.' };
  }
}

export async function testLineChannel(
  _prev: LineChannelActionState,
  formData: FormData,
): Promise<LineChannelActionState> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return { status: 'error', message: 'Missing id.' };
  const channel = await getLineChannelById(id);
  if (!channel) return { status: 'error', message: 'Channel not found.' };
  const result = await sendLinePushMessage({
    accessToken: channel.tokenPlaintext as unknown as string,
    groupId: channel.groupId,
    text: `[Songdee] Test message · ${new Date().toISOString()}`,
  });
  if (!result.ok) return { status: 'error', message: result.errorMessage };
  return { status: 'success', message: 'Test message sent.' };
}
