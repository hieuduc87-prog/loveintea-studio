import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';

function isAdminOrAbove(role: string) {
  return role === 'root_admin' || role === 'admin';
}

// ── PATCH /api/admin/users/[id] — update role / is_approved ──
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const sessionRole = (session?.user as any)?.role as string | undefined;
  const sessionId = (session?.user as any)?.id as string | undefined;

  if (!session?.user || !isAdminOrAbove(sessionRole ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { role, is_approved } = body as { role?: string; is_approved?: number };

  const db = getDb();
  const existing = db
    .prepare('SELECT id, role, is_approved FROM auth_users WHERE id = ?')
    .get(id) as { id: string; role: string; is_approved: number } | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Cannot change own role
  if (id === sessionId && role !== undefined) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  // admin cannot manage root_admin or other admins
  if (sessionRole === 'admin') {
    if (existing.role === 'root_admin' || existing.role === 'admin') {
      return NextResponse.json({ error: 'Forbidden: cannot manage admin-level users' }, { status: 403 });
    }
    if (role === 'root_admin' || role === 'admin') {
      return NextResponse.json({ error: 'Forbidden: cannot assign admin-level roles' }, { status: 403 });
    }
  }

  // Prevent downgrading last root_admin
  if (role && role !== 'root_admin' && existing.role === 'root_admin') {
    const rootAdminCount = (db.prepare(
      "SELECT COUNT(*) as c FROM auth_users WHERE role = 'root_admin' AND is_approved = 1"
    ).get() as { c: number }).c;
    if (rootAdminCount <= 1) {
      return NextResponse.json({ error: 'Cannot downgrade the last root_admin' }, { status: 400 });
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (role !== undefined)        { fields.push('role = ?');        values.push(role); }
  if (is_approved !== undefined) { fields.push('is_approved = ?'); values.push(is_approved); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  values.push(id);
  db.prepare(`UPDATE auth_users SET ${fields.join(', ')} WHERE id = ?`).run(...(values as any[]));

  // If blocking, invalidate sessions
  if (is_approved === -1) {
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
  }

  const updated = db.prepare(
    'SELECT id, name, email, image, role, is_approved, created_at, last_login FROM auth_users WHERE id = ?'
  ).get(id);

  return NextResponse.json({ user: updated });
}

// ── DELETE /api/admin/users/[id] — block user (soft) ──────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const sessionRole = (session?.user as any)?.role as string | undefined;
  const sessionId = (session?.user as any)?.id as string | undefined;

  if (!session?.user || !isAdminOrAbove(sessionRole ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  if (sessionId === id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, role FROM auth_users WHERE id = ?')
    .get(id) as { id: string; role: string } | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // admin cannot block root_admin or other admins
  if (sessionRole === 'admin') {
    if (existing.role === 'root_admin' || existing.role === 'admin') {
      return NextResponse.json({ error: 'Forbidden: cannot block admin-level users' }, { status: 403 });
    }
  }

  // Set is_approved = -1 (blocked — records preserved)
  db.prepare('UPDATE auth_users SET is_approved = -1 WHERE id = ?').run(id);
  // Invalidate all their sessions
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);

  return NextResponse.json({ ok: true });
}
