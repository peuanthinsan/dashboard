import NextAuth from 'next-auth';
import { authConfig } from 'app/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Run on app routes AND /api/* (except NextAuth's own callback). The `authorized`
  // callback in auth.config returns 401 for unauthenticated /api/* requests instead
  // of redirecting, so JSON clients see a clean error.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
