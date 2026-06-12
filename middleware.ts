import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Auth + role enforcement:
 *  - Everyone must be signed in (matcher excludes public routes below).
 *  - /api/admin/* — admin & root_admin only (403 JSON).
 *  - viewer role — read-only: mutating API calls are rejected (403 JSON).
 */
export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token as { role?: string } | null)?.role ?? 'viewer';
    const { pathname } = req.nextUrl;
    const isApi = pathname.startsWith('/api/');
    const isAdmin = role === 'admin' || role === 'root_admin';
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    if (pathname.startsWith('/api/admin') && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }
    if (isApi && isWrite && role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden — viewer role is read-only. Ask an admin to upgrade your role.' }, { status: 403 });
    }
    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => Boolean(token) } }
);

export const config = {
  matcher: [
    // Public (no auth): api/auth (NextAuth), api/webhooks (FB deauthorize),
    // api/images (FB/IG servers must fetch published images),
    // api/payment/webhook + momo-callback (bank/MoMo IPN callbacks)
    '/((?!api/auth|api/webhooks|api/images|api/payment/webhook|api/payment/momo-callback|login|_next/static|_next/image|favicon.ico|brand|public).*)',
  ],
};
