import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), authenticate: vi.fn() }));
vi.mock('app/auth', () => ({ GET: mocks.get, POST: mocks.post }));
vi.mock('next-auth', () => ({ default: () => ({ auth: mocks.authenticate }) }));

import { GET, POST } from '../api/auth/[...nextauth]/route';
import proxy from '../../proxy';

beforeEach(() => {
  vi.stubEnv('SONGDEE_WINDOWS_HOSTING', '1');
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe('auth route and proxy origin adapters', () => {
  it('passes cloud requests and responses through without adding Windows header overrides', async () => {
    vi.stubEnv('SONGDEE_WINDOWS_HOSTING', undefined);
    const request = new NextRequest('https://preview.vercel.app/dashboard', {
      headers: { host: 'preview.vercel.app', 'x-forwarded-proto': 'https' },
    });
    const response = NextResponse.next();
    mocks.authenticate.mockResolvedValue(response);
    expect(await proxy(request, {} as NextFetchEvent)).toBe(response);
    expect(mocks.authenticate.mock.calls[0][0]).toBe(request);
    expect(response.headers.has('x-middleware-override-headers')).toBe(false);
  });

  it.each([['GET', GET, mocks.get], ['POST', POST, mocks.post]] as const)(
    '%s authenticates with the normalized public origin', async (method, handler, mock) => {
      const response = new Response('ok');
      mock.mockReturnValue(response);
      expect(await handler(new NextRequest('http://localhost:8080/api/auth/session', {
        method, headers: { host: 'dashboard.songdeegps.com' },
        ...(method === 'POST' ? { body: 'dummy' } : {}),
      }))).toBe(response);
      expect(mock.mock.calls[0][0].url).toBe('https://dashboard.songdeegps.com/api/auth/session');
    },
  );

  it('rejects an unapproved host before calling either auth handler', async () => {
    const request = new NextRequest('http://localhost:8080/api/auth/session', { headers: { host: 'attacker.example' } });
    expect((await GET(request)).status).toBe(404);
    expect((await POST(request)).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('forwards corrected headers to server actions and retains auth cookies', async () => {
    const response = NextResponse.next();
    response.cookies.set('auth-session', 'dummy');
    mocks.authenticate.mockResolvedValue(response);
    const result = await proxy(new NextRequest('http://localhost:8080/dashboard', {
      headers: { host: 'dashboard.songdeegps.com', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http' },
    }), {} as NextFetchEvent);
    expect(result).toBe(response);
    expect(response.headers.get('x-middleware-request-host')).toBe('dashboard.songdeegps.com');
    expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBe('dashboard.songdeegps.com');
    expect(response.headers.get('x-middleware-request-x-forwarded-proto')).toBe('https');
    expect(response.cookies.get('auth-session')?.value).toBe('dummy');
  });

  it('preserves an authentication redirect without forwarding internal request headers', async () => {
    const response = NextResponse.redirect('https://dashboard.songdeegps.com/login');
    mocks.authenticate.mockResolvedValue(response);
    expect(await proxy(new NextRequest('http://localhost:8080/dashboard', {
      headers: { host: 'dashboard.songdeegps.com' },
    }), {} as NextFetchEvent)).toBe(response);
    expect(response.headers.has('x-middleware-override-headers')).toBe(false);
  });

  it('redirects loopback requests without invoking authentication', async () => {
    const result = await proxy(new NextRequest('http://localhost:8080/dashboard', {
      headers: { host: '127.0.0.1:8080' },
    }), {} as NextFetchEvent);
    expect(result?.status).toBe(307);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
});
