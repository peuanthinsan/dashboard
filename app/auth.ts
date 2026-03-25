import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcrypt-ts';
import { z } from 'zod';
import { getUserForAuth } from 'app/db';
import { authConfig } from 'app/auth.config';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);
        if (!parsed.success) {
          console.warn('Invalid credentials payload received.');
          return null;
        }
        const { email, password } = parsed.data;
        const user = await getUserForAuth(email);
        if (user.length === 0) return null;
        const passwordsMatch = await compare(password, user[0].password!);
        if (passwordsMatch) {
          const row = user[0];
          return {
            id: String(row.id),
            email: row.email,
            name: row.email,
          };
        }
        return null;
      },
    }),
  ],
});
