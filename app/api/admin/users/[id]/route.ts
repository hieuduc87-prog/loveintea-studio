import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';

// ── PATCH /api/admin/users/[id] — update role / is_approved ──
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { role, is_approved } = body;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(id) as any;
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const fields: string[] = [];
  const values: any[] = [];
  if (role !== undefined)       { fields.push('role = ?');        values.push(role); }
  if (is_approved !== undefined){ fields.push('is_approved = ?'); values.push(is_approved); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  values.push(id);
  db.prepare(`UPDATE auth_users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(
    'SELECT id, name, email, image, role, is_approved, created_at, last_login FROM auth_users WHERE id = ?'
  ).get(id);

  return NextResponse.json({ user: updated });
}

// ── DELETE /api/admin/users/[id] — block user ─────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  // Prevent self-block
  if ((session.user as any).id === id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(id) as any;
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Set is_approved = -1 (blocked)
  db.prepare('UPDATE auth_users SET is_approved = -1 WHERE id = ?').run(id);
  // Invalidate all their sessions
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);

  return NextResponse.json({ ok: true });
}
