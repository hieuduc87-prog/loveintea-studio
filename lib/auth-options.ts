import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteAdapter } from './auth-adapter';
import { getDb } from './db';

export const authOptions: NextAuthOptions = {
  adapter: SQLiteAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;

      const db = getDb();
      const existing = db
        .prepare('SELECT id, is_approved, role FROM auth_users WHERE email = ?')
        .get(user.email) as { id: string; is_approved: number; role: string } | undefined;

      if (!existing) {
        // Auto-create as pending viewer — admin will approve
        db.prepare(
          `INSERT OR IGNORE INTO auth_users (id, name, email, image, role, is_approved, created_at)
           VALUES (?, ?, ?, ?, 'viewer', 0, datetime('now'))`
        ).run(uuidv4(), user.name || user.email, user.email, user.image || '');
        return '/login?error=pending';
      }

      if (existing.is_approved === -1) return '/login?error=blocked';
      if (existing.is_approved === 0) return '/login?error=pending';
      return true;
    },

    async jwt({ token, user }) {
      // On first sign-in, user is available — enrich token with DB data
      if (user?.email) {
        const db = getDb();
        const dbUser = db
          .prepare('SELECT id, role, is_approved FROM auth_users WHERE email = ?')
          .get(user.email) as { id: string; role: string; is_approved: number } | undefined;

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.is_approved = dbUser.is_approved;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'viewer';

        // Update last_login + sync name/image
        if (token.id) {
          const db = getDb();
          db.prepare('UPDATE auth_users SET last_login = ? WHERE id = ?').run(
            new Date().toISOString(),
            token.id
          );
          if (token.name) {
            db.prepare('UPDATE auth_users SET name=?, image=? WHERE id=?').run(
              token.name,
              (token.picture as string) ?? null,
              token.id
            );
          }
        }
      }
      return session;
    },
  },

  events: {
    async createUser() {
      // No-op: root users are pre-seeded. New users start as pending viewers.
    },
  },
};
