import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, genPassword } from '@/lib/password';

function isAdminOrAbove(role: string) {
  return role === 'root_admin' || role === 'admin';
}

// ── GET /api/admin/users — list all users ──────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionRole = (session?.user as any)?.role as string | undefined;

  if (!session?.user || !isAdminOrAbove(sessionRole ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  // Sort: pending first (is_approved=0), then approved (is_approved=1), then blocked (is_approved=-1)
  const users = db.prepare(`
    SELECT id, name, email, image, role, is_approved, created_at, last_login
    FROM auth_users
    ORDER BY
      CASE is_approved WHEN 0 THEN 0 WHEN 1 THEN 1 ELSE 2 END ASC,
      created_at ASC
  `).all();

  const pendingCount = (users as any[]).filter((u: any) => u.is_approved === 0).length;

  return NextResponse.json(
    { users },
    {
      headers: {
        'X-Pending-Count': String(pendingCount),
      },
    }
  );
}

// ── POST /api/admin/users — invite or action on user ──────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionRole = (session?.user as any)?.role as string | undefined;
  const sessionId = (session?.user as any)?.id as string | undefined;

  if (!session?.user || !isAdminOrAbove(sessionRole ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { email, role, action } = body as {
    email?: string;
    role?: string;
    action?: 'invite' | 'approve' | 'block' | 'unblock';
  };

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, role, is_approved FROM auth_users WHERE email = ?')
    .get(email) as { id: string; role: string; is_approved: number } | undefined;

  // Permission check: admin cannot manage root_admin or other admins
  if (existing && sessionRole === 'admin') {
    if (existing.role === 'root_admin' || existing.role === 'admin') {
      return NextResponse.json({ error: 'Forbidden: cannot manage admin-level users' }, { status: 403 });
    }
  }

  // Permission check for role assignment: admin cannot assign admin/root_admin roles
  if (role && sessionRole === 'admin') {
    if (role === 'root_admin' || role === 'admin') {
      return NextResponse.json({ error: 'Forbidden: cannot assign admin-level roles' }, { status: 403 });
    }
  }

  const resolvedAction = action ?? 'invite';

  if (!existing) {
    if (resolvedAction === 'invite') {
      // Pre-approved invitation — signs in with Google OR the temp password below
      // (must change it on first password login).
      const id = uuidv4();
      const roleVal = role ?? 'viewer';
      const tempPassword = genPassword();
      db.prepare(
        `INSERT INTO auth_users (id, email, role, is_approved, password_hash, must_change_password, created_at)
         VALUES (?, ?, ?, 1, ?, 1, datetime('now'))`
      ).run(id, email, roleVal, hashPassword(tempPassword));
      const created = db.prepare(
        'SELECT id, name, email, image, role, is_approved, created_at, last_login FROM auth_users WHERE id = ?'
      ).get(id);
      return NextResponse.json({ user: created, tempPassword }, { status: 201 });
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  switch (resolvedAction) {
    case 'approve':
      db.prepare('UPDATE auth_users SET is_approved = 1 WHERE email = ?').run(email);
      if (role) db.prepare('UPDATE auth_users SET role = ? WHERE email = ?').run(role, email);
      break;
    case 'block':
      // Cannot block yourself
      if (existing.id === sessionId) {
        return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
      }
      db.prepare('UPDATE auth_users SET is_approved = -1 WHERE email = ?').run(email);
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(existing.id);
      break;
    case 'unblock':
      db.prepare('UPDATE auth_users SET is_approved = 1 WHERE email = ?').run(email);
      break;
    case 'invite':
    default:
      // Update existing user
      if (role) db.prepare('UPDATE auth_users SET role = ? WHERE email = ?').run(role, email);
      db.prepare('UPDATE auth_users SET is_approved = 1 WHERE email = ?').run(email);
      break;
  }

  const updated = db.prepare(
    'SELECT id, name, email, image, role, is_approved, created_at, last_login FROM auth_users WHERE email = ?'
  ).get(email);
  return NextResponse.json({ user: updated });
}
