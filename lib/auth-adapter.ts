import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken,
} from 'next-auth/adapters';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';

// Raw row shapes from SQLite
interface RawUser {
  id: string;
  name: string | null;
  email: string;
  email_verified: string | null;
  image: string | null;
  role: string;
  is_approved: number;
  created_at: string;
  last_login: string | null;
}

interface RawSession {
  id: string;
  session_token: string;
  user_id: string;
  expires: string;
}

interface RawVerificationToken {
  identifier: string;
  token: string;
  expires: string;
}

function mapUser(row: RawUser): AdapterUser & { role: string; is_approved: number } {
  return {
    id: row.id,
    name: row.name ?? null,
    email: row.email,
    emailVerified: row.email_verified ? new Date(row.email_verified) : null,
    image: row.image ?? null,
    role: row.role ?? 'viewer',
    is_approved: row.is_approved ?? 0,
  };
}

function mapSession(row: RawSession): AdapterSession {
  return {
    sessionToken: row.session_token,
    userId: row.user_id,
    expires: new Date(row.expires),
  };
}

export function SQLiteAdapter(): Adapter {
  return {
    // ── Users ──────────────────────────────────────────────
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const db = getDb();
      const id = uuidv4();
      db.prepare(
        'INSERT INTO auth_users (id, name, email, email_verified, image) VALUES (?, ?, ?, ?, ?)'
      ).run(
        id,
        user.name ?? null,
        user.email,
        user.emailVerified ? user.emailVerified.toISOString() : null,
        user.image ?? null
      );
      const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id) as RawUser;
      return mapUser(row);
    },

    async getUser(id: string) {
      const db = getDb();
      const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id) as RawUser | undefined;
      if (!row) return null;
      return mapUser(row);
    },

    async getUserByEmail(email: string) {
      const db = getDb();
      const row = db.prepare('SELECT * FROM auth_users WHERE email = ?').get(email) as RawUser | undefined;
      if (!row) return null;
      return mapUser(row);
    },

    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const db = getDb();
      const row = db.prepare(`
        SELECT u.* FROM auth_users u
        INNER JOIN auth_accounts a ON a.user_id = u.id
        WHERE a.provider = ? AND a.provider_account_id = ?
      `).get(provider, providerAccountId) as RawUser | undefined;
      if (!row) return null;
      return mapUser(row);
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      const db = getDb();
      db.prepare(`
        UPDATE auth_users SET
          name = ?,
          email = ?,
          email_verified = ?,
          image = ?
        WHERE id = ?
      `).run(
        user.name ?? null,
        user.email,
        user.emailVerified ? user.emailVerified.toISOString() : null,
        user.image ?? null,
        user.id
      );
      const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(user.id) as RawUser;
      return mapUser(row);
    },

    async deleteUser(userId: string) {
      const db = getDb();
      db.prepare('DELETE FROM auth_accounts WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM auth_users WHERE id = ?').run(userId);
    },

    // ── Accounts ───────────────────────────────────────────
    async linkAccount(account: AdapterAccount) {
      const db = getDb();
      const id = uuidv4();
      db.prepare(`
        INSERT INTO auth_accounts (
          id, user_id, type, provider, provider_account_id,
          refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        account.userId,
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.token_type ?? null,
        account.scope ?? null,
        account.id_token ?? null,
        account.session_state ?? null
      );
      return account;
    },

    async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const db = getDb();
      db.prepare(
        'DELETE FROM auth_accounts WHERE provider = ? AND provider_account_id = ?'
      ).run(provider, providerAccountId);
    },

    // ── Sessions ───────────────────────────────────────────
    async createSession({ sessionToken, userId, expires }: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) {
      const db = getDb();
      const id = uuidv4();
      db.prepare(
        'INSERT INTO auth_sessions (id, session_token, user_id, expires) VALUES (?, ?, ?, ?)'
      ).run(id, sessionToken, userId, expires.toISOString());
      return { sessionToken, userId, expires };
    },

    async getSessionAndUser(sessionToken: string) {
      const db = getDb();
      const sessionRow = db.prepare(
        'SELECT * FROM auth_sessions WHERE session_token = ?'
      ).get(sessionToken) as RawSession | undefined;
      if (!sessionRow) return null;

      const userRow = db.prepare(
        'SELECT * FROM auth_users WHERE id = ?'
      ).get(sessionRow.user_id) as RawUser | undefined;
      if (!userRow) return null;

      return {
        session: mapSession(sessionRow),
        user: mapUser(userRow),
      };
    },

    async updateSession({ sessionToken, expires }: {
      sessionToken: string;
      expires?: Date;
      userId?: string;
    }) {
      const db = getDb();
      if (expires) {
        db.prepare(
          'UPDATE auth_sessions SET expires = ? WHERE session_token = ?'
        ).run(expires.toISOString(), sessionToken);
      }
      const row = db.prepare(
        'SELECT * FROM auth_sessions WHERE session_token = ?'
      ).get(sessionToken) as RawSession | undefined;
      if (!row) return null;
      return mapSession(row);
    },

    async deleteSession(sessionToken: string) {
      const db = getDb();
      db.prepare('DELETE FROM auth_sessions WHERE session_token = ?').run(sessionToken);
    },

    // ── Verification Tokens ───────────────────────────────
    async createVerificationToken({ identifier, token, expires }: VerificationToken) {
      const db = getDb();
      db.prepare(
        'INSERT INTO auth_verification_tokens (identifier, token, expires) VALUES (?, ?, ?)'
      ).run(identifier, token, expires.toISOString());
      return { identifier, token, expires };
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const db = getDb();
      const row = db.prepare(
        'SELECT * FROM auth_verification_tokens WHERE identifier = ? AND token = ?'
      ).get(identifier, token) as RawVerificationToken | undefined;
      if (!row) return null;
      db.prepare(
        'DELETE FROM auth_verification_tokens WHERE identifier = ? AND token = ?'
      ).run(identifier, token);
      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(row.expires),
      };
    },
  };
}
