import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeAuthRequest } from './request-origin';

afterEach(() => vi.unstubAllEnvs());

function request(host: string | null, extraHeaders: Record<string, string> = {}) {
  return new NextRequest('http://localhost:8080/api/auth/session?next=%2Fdashboard', {
    headers: { ...(host === null ? {} : { host }), ...extraHeaders },
  });
}

describe('Windows request origins', () => {
  it.each([undefined, '0', 'true'])('keeps the cloud request untouched when the flag is %s', (flag) => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', flag);
    const original = request('preview.vercel.app', { 'x-forwarded-proto': 'https' });
    expect(normalizeAuthRequest(original)).toBe(original);
  });

  it('sets the public origin from the allowed host and replaces spoofed forwarding headers', () => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
    const normalized = normalizeAuthRequest(request('DASHBOARD.SONGDEEGPS.COM:443', {
      'x-forwarded-host': 'attacker.example',
      'x-forwarded-proto': 'http',
      cookie: 'session=value',
    }));
    expect(normalized).toBeInstanceOf(NextRequest);
    expect((normalized as NextRequest).url).toBe('https://dashboard.songdeegps.com/api/auth/session?next=%2Fdashboard');
    expect(normalized.headers.get('host')).toBe('dashboard.songdeegps.com');
    expect(normalized.headers.get('x-forwarded-host')).toBe('dashboard.songdeegps.com');
    expect(normalized.headers.get('x-forwarded-proto')).toBe('https');
    expect(normalized.headers.get('cookie')).toBe('session=value');
  });

  it.each(['localhost:8080', '172.24.8.104:8080'])('keeps local origin %s on HTTP', (host) => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
    const normalized = normalizeAuthRequest(request(host, { 'x-forwarded-proto': 'https' }));
    expect(normalized).toBeInstanceOf(NextRequest);
    expect((normalized as NextRequest).nextUrl.origin).toBe(`http://${host}`);
    expect(normalized.headers.get('x-forwarded-proto')).toBe('http');
  });

  it('redirects loopback IP requests to the browser cookie origin while preserving path and query', () => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
    const normalized = normalizeAuthRequest(request('127.0.0.1:8080'));
    expect(normalized).toBeInstanceOf(NextResponse);
    expect((normalized as NextResponse).status).toBe(307);
    expect(normalized.headers.get('location')).toBe('http://localhost:8080/api/auth/session?next=%2Fdashboard');
  });

  it.each(['attacker.example', 'dashboard.songdeegps.com.attacker.example', 'dashboard.songdeegps.com:8080',
    'localhost:443', '172.24.8.104:9999', 'dashboard.songdeegps.com:80', 'localhost:80'])('rejects host %s', (host) => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
    expect((normalizeAuthRequest(request(host)) as NextResponse).status).toBe(404);
  });

  it.each([null, 'user@localhost:8080', 'localhost:8080/path', 'localhost:8080?query=1'])('rejects malformed host %s', (host) => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
    expect((normalizeAuthRequest(request(host)) as NextResponse).status).toBe(400);
  });

  it('preserves an auth POST body and cancellation signal', async () => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
    const controller = new AbortController();
    const original = new NextRequest('http://localhost:8080/api/auth/callback/credentials', {
      method: 'POST',
      headers: { host: 'dashboard.songdeegps.com', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'csrfToken=dummy&email=example%40example.com',
      signal: controller.signal,
    });
    const normalized = normalizeAuthRequest(original) as NextRequest;
    expect(normalized.method).toBe('POST');
    expect(await normalized.text()).toBe('csrfToken=dummy&email=example%40example.com');
    controller.abort();
    expect(normalized.signal.aborted).toBe(true);
  });
});
