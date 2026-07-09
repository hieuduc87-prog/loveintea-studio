import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteAdapter } from './auth-adapter';
import { getDb } from './db';
import { verifyPassword } from './password';

export const authOptions: NextAuthOptions = {
  adapter: SQLiteAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    // Email + password for admin-provisioned customers (no Google needed).
    CredentialsProvider({
      name: 'Email',
      credentials: { email: { label: 'Email', type: 'text' }, password: { label: 'Mật khẩu', type: 'password' } },
      async authorize(credentials) {
        const email = (credentials?.email || '').trim().toLowerCase();
        const password = credentials?.password || '';
        if (!email || !password) return null;
        const db = getDb();
        const u = db.prepare('SELECT id, name, email, role, is_approved, password_hash FROM auth_users WHERE email = ?')
          .get(email) as { id: string; name: string; email: string; role: string; is_approved: number; password_hash: string | null } | undefined;
        if (!u || !u.password_hash) return null;
        if (u.is_approved !== 1) return null;
        if (!verifyPassword(password, u.password_hash)) return null;
        db.prepare('UPDATE auth_users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), u.id);
        return { id: u.id, email: u.email, name: u.name, role: u.role, is_approved: u.is_approved };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  // Cross-subdomain session sharing (app.<domain> + admin.<domain>) when
  // COOKIE_DOMAIN is set in prod (e.g. .easycreativehub.com). Default otherwise.
  ...(process.env.COOKIE_DOMAIN ? {
    cookies: {
      sessionToken: {
        name: '__Secure-next-auth.session-token',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, domain: process.env.COOKIE_DOMAIN },
      },
    },
  } : {}),
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
      // On first sign-in, user is available — enrich token with DB data.
      // Also backfill role for older JWTs issued before the role claim existed
      // (otherwise the role middleware would treat the owner as read-only viewer).
      const email = user?.email ?? (!token.role ? token.email : null);
      if (email) {
        const db = getDb();
        const dbUser = db
          .prepare('SELECT id, role, is_approved FROM auth_users WHERE email = ?')
          .get(email) as { id: string; role: string; is_approved: number } | undefined;

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.is_approved = dbUser.is_approved;
        }
      }

      // Refresh brand access on EVERY request (cheap indexed query) so a newly
      // assigned brand takes effect without forcing the user to re-login.
      // Admins/root_admins bypass membership entirely (super-admin: all brands).
      if (token.id) {
        const db = getDb();
        const isAdmin = token.role === 'admin' || token.role === 'root_admin';
        token.allBrands = isAdmin;
        if (isAdmin) {
          token.brands = [];
        } else {
          const rows = db
            .prepare('SELECT brand_id FROM brand_members WHERE user_id = ?')
            .all(token.id) as Array<{ brand_id: string }>;
          token.brands = rows.map((r) => r.brand_id);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'viewer';
        session.user.brands = (token.brands as string[]) || [];
        session.user.allBrands = Boolean(token.allBrands);

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
