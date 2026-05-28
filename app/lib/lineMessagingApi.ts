type SendArgs = {
  accessToken: string;
  groupId: string;
  text: string;
  timeoutMs?: number;
};

type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; code: 'line-api' | 'timeout'; errorMessage: string };

const ENDPOINT = 'https://api.line.me/v2/bot/message/push';

export async function sendLinePushMessage(args: SendArgs): Promise<SendResult> {
  const { accessToken, groupId, text, timeoutMs = 5000 } = args;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const errorMessage = body.length > 0 ? body.slice(0, 240) : `HTTP ${res.status}`;
      return { ok: false, code: 'line-api', errorMessage };
    }
    const data = (await res.json().catch(() => ({}))) as { sentMessages?: Array<{ id?: string }> };
    const messageId = data.sentMessages?.[0]?.id ?? null;
    return { ok: true, messageId };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, code: 'timeout', errorMessage: 'LINE API request timed out' };
    }
    return { ok: false, code: 'line-api', errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
