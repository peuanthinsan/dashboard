import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendLinePushMessage } from './lineMessagingApi';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('sendLinePushMessage', () => {
  it('POSTs to /v2/bot/message/push with correct body and Authorization', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ sentMessages: [{ id: 'M1' }] }), { status: 200 }),
    );
    const result = await sendLinePushMessage({
      accessToken: 'TOKEN',
      groupId: 'C123',
      text: 'hello',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messageId).toBe('M1');
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://api.line.me/v2/bot/message/push');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers).toMatchObject({ Authorization: 'Bearer TOKEN', 'Content-Type': 'application/json' });
    expect(JSON.parse(call[1].body)).toEqual({ to: 'C123', messages: [{ type: 'text', text: 'hello' }] });
  });

  it('returns ok=false with short error on non-2xx', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Invalid reply token' }), { status: 400 }),
    );
    const result = await sendLinePushMessage({
      accessToken: 'TOKEN',
      groupId: 'C123',
      text: 'hello',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('line-api');
      expect(result.errorMessage).toMatch(/Invalid reply token/);
    }
  });

  it('returns ok=false code=timeout on AbortError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      const err = new Error('aborted');
      err.name = 'TimeoutError';
      return Promise.reject(err);
    });
    const result = await sendLinePushMessage({
      accessToken: 'TOKEN',
      groupId: 'C123',
      text: 'hello',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('timeout');
  });
});
