import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// ── GET /api/admin/users — list all users ──────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const users = db.prepare(`
    SELECT id, name, email, image, role, is_approved, created_at, last_login
    FROM auth_users
    ORDER BY created_at ASC
  `).all();

  return NextResponse.json({ users });
}

// ── POST /api/admin/users — invite or update user ─────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, role, is_approved } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM auth_users WHERE email = ?').get(email) as any;

  if (existing) {
    // Update existing user
    const fields: string[] = [];
    const values: any[] = [];
    if (role !== undefined) { fields.push('role = ?'); values.push(role); }
    if (is_approved !== undefined) { fields.push('is_approved = ?'); values.push(is_approved); }
    if (fields.length > 0) {
      values.push(existing.id);
      db.prepare(`UPDATE auth_users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    const updated = db.prepare(
      'SELECT id, name, email, image, role, is_approved, created_at, last_login FROM auth_users WHERE id = ?'
    ).get(existing.id);
    return NextResponse.json({ user: updated });
  } else {
    // Create placeholder (pre-approved invitation)
    const id = uuidv4();
    const approvedVal = is_approved ?? 1; // default: pre-approved
    const roleVal = role ?? 'viewer';
    db.prepare(
      'INSERT INTO auth_users (id, email, role, is_approved) VALUES (?, ?, ?, ?)'
    ).run(id, email, roleVal, approvedVal);
    const created = db.prepare(
      'SELECT id, name, email, image, role, is_approved, created_at, last_login FROM auth_users WHERE id = ?'
    ).get(id);
    return NextResponse.json({ user: created }, { status: 201 });
  }
}
