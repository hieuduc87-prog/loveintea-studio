import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { SQLiteAdapter } from './auth-adapter';
import { getDb } from './db';

export const authOptions: NextAuthOptions = {
  adapter: SQLiteAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      const db = getDb();
      const countRow = db.prepare('SELECT COUNT(*) as c FROM auth_users').get() as { c: number };

      if (countRow.c === 0) {
        // First ever user — allow, createUser event will promote to admin
        return true;
      }

      const dbUser = db
        .prepare('SELECT is_approved FROM auth_users WHERE email = ?')
        .get(user.email) as { is_approved: number } | undefined;

      if (!dbUser) return '/login?error=not_invited';
      if (dbUser.is_approved === -1) return '/login?error=blocked';
      if (dbUser.is_approved === 0) return '/login?error=pending';
      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as any).role;
        const db = getDb();
        db.prepare('UPDATE auth_users SET last_login = ? WHERE id = ?').run(
          new Date().toISOString(),
          user.id
        );
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      const db = getDb();
      const countRow = db.prepare('SELECT COUNT(*) as c FROM auth_users').get() as { c: number };
      if (countRow.c <= 1) {
        db.prepare('UPDATE auth_users SET is_approved = 1, role = ? WHERE id = ?').run(
          'admin',
          user.id
        );
      }
    },
  },
};
