import NextAuth from 'next-auth';
import { authConfig } from 'app/auth.config';
import { NextRequest, NextResponse, type NextFetchEvent, type NextMiddleware } from 'next/server';
import { normalizeAuthRequest } from 'app/lib/request-origin';

const authenticate = NextAuth(authConfig).auth as NextMiddleware;

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const normalized = normalizeAuthRequest(request);
  if (!(normalized instanceof NextRequest)) return normalized;
  const response = await authenticate(normalized, event);
  if (normalized !== request && response?.headers.get('x-middleware-next') === '1') {
    // Server actions read Next's request headers separately from middleware.
    const forwarded = NextResponse.next({ request: { headers: normalized.headers } });
    for (const [name, value] of forwarded.headers) response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Run on app routes AND /api/* (except NextAuth's own callback). The `authorized`
  // callback in auth.config returns 401 for unauthenticated /api/* requests instead
  // of redirecting, so JSON clients see a clean error.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
