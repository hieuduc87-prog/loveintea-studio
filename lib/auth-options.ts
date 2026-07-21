import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteAdapter } from './auth-adapter';
import { getDb } from './db';
import { verifyPassword } from './password';
import { rateLimit } from './rate-limit';

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
      async authorize(credentials, req) {
        const email = (credentials?.email || '').trim().toLowerCase();
        const password = credentials?.password || '';
        if (!email || !password) return null;
        // Brute-force throttle (no limiter existed): 5 attempts / 15 min per
        // email, 20 / 15 min per IP. In-memory, single-container — see rate-limit.ts.
        const h = (req?.headers ?? {}) as Record<string, string | undefined>;
        const ip = h['cf-connecting-ip'] || h['x-real-ip'] ||
          (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
        if (!rateLimit(`login:email:${email}`, 5, 15 * 60_000).ok) return null;
        if (!rateLimit(`login:ip:${ip}`, 20, 15 * 60_000).ok) return null;
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
      // Session dùng chung app.↔admin. Các cookie của LUỒNG OAuth (state/pkce/nonce/
      // callback-url) cũng PHẢI domain-scoped: nếu login khởi tạo ở 1 subdomain nhưng
      // callback luôn về app.<domain>, cookie host-only sẽ mất → "State cookie was missing".
      // csrf giữ mặc định (__Host- prefix cấm thuộc tính domain).
      sessionToken: {
        name: '__Secure-next-auth.session-token',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, domain: process.env.COOKIE_DOMAIN },
      },
      callbackUrl: {
        name: '__Secure-next-auth.callback-url',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, domain: process.env.COOKIE_DOMAIN },
      },
      state: {
        name: '__Secure-next-auth.state',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900, domain: process.env.COOKIE_DOMAIN },
      },
      pkceCodeVerifier: {
        name: '__Secure-next-auth.pkce.code_verifier',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900, domain: process.env.COOKIE_DOMAIN },
      },
      nonce: {
        name: '__Secure-next-auth.nonce',
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
        // Temp-password gate: refreshed every request so the flag clears ngay
        // sau khi user đổi mật khẩu (không cần re-login).
        const pwRow = db.prepare('SELECT must_change_password FROM auth_users WHERE id = ?')
          .get(token.id) as { must_change_password?: number } | undefined;
        token.mustChangePassword = !!pwRow?.must_change_password;
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
