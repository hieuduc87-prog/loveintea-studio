export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { enforceRateLimit } from '@/lib/rate-limit';

// POST /api/account/password { newPassword } — logged-in user changes own password.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const limited = enforceRateLimit(req, { scope: 'account:password', key: userId, limit: 5, windowMs: 15 * 60_000 });
  if (limited) return limited;

  const { newPassword } = await req.json() as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, { status: 400 });
  }
  getDb().prepare('UPDATE auth_users SET password_hash=?, must_change_password=0 WHERE id=?')
    .run(hashPassword(newPassword), userId);
  return NextResponse.json({ ok: true });
}
