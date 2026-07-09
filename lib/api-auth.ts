import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

/**
 * In-handler auth guards (defense-in-depth, and REQUIRED for routes the
 * middleware matcher excludes — e.g. everything under /api/auth, which is public
 * so NextAuth can run its own endpoints there).
 *
 * Usage:
 *   const auth = await requireSession();
 *   if ('error' in auth) return auth.error;
 *   // auth.session, auth.role available
 */

export function isAdminOrAbove(role: string | undefined | null): boolean {
  return role === 'root_admin' || role === 'admin';
}

type SessionInfo = {
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
  role: string;
  userId: string | undefined;
};

/** Require any signed-in user. Returns the session or a 401 response. */
export async function requireSession(): Promise<SessionInfo | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized — cần đăng nhập.' }, { status: 401 }) };
  }
  const role = ((session.user as any)?.role as string) ?? 'viewer';
  const userId = (session.user as any)?.id as string | undefined;
  return { session, role, userId };
}

/** Require an admin / root_admin session. Returns the session or a 403 response. */
export async function requireAdminSession(): Promise<SessionInfo | { error: NextResponse }> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  if (!isAdminOrAbove(auth.role)) {
    return { error: NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 }) };
  }
  return auth;
}
