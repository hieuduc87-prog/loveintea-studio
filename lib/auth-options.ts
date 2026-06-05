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
    }),
  ],
  session: { strategy: 'database' },
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
          `INSERT INTO auth_users (id, name, email, image, role, is_approved, created_at)
           VALUES (?, ?, ?, ?, 'viewer', 0, datetime('now'))`
        ).run(uuidv4(), user.name || user.email, user.email, user.image || '');
        return '/login?error=pending';
      }

      if (existing.is_approved === -1) return '/login?error=blocked';
      if (existing.is_approved === 0) return '/login?error=pending';
      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as any).role || 'viewer';

        const db = getDb();
        // Update last_login
        db.prepare('UPDATE auth_users SET last_login = ? WHERE id = ?').run(
          new Date().toISOString(),
          user.id
        );
        // Sync name/image from Google
        if (user.name) {
          db.prepare('UPDATE auth_users SET name=?, image=? WHERE id=?').run(
            user.name,
            (user as any).image ?? null,
            user.id
          );
        }
      }
      return session;
    },
  },

  events: {
    // createUser is intentionally left minimal — seeding is done via SQL in initSchema
    async createUser() {
      // No-op: root users are pre-seeded via SQL. New users start as pending viewers.
    },
  },
};
