import { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isAuthRoute = path.startsWith('/api/auth/');
      const isProtected =
        path.startsWith('/dashboard') ||
        path.startsWith('/admin') ||
        // /api/* is gated EXCEPT NextAuth's own callback URL.
        (path.startsWith('/api/') && !isAuthRoute);

      if (isProtected) {
        if (isLoggedIn) return true;
        // For API routes, return a 401 instead of redirecting to /login (which would
        // produce an HTML response inside an XHR/fetch and break the client).
        if (path.startsWith('/api/')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return false;
      } else if (isLoggedIn && (path === '/login' || path === '/register')) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
