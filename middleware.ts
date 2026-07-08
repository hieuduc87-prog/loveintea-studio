import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Auth + role + BRAND-TENANT enforcement (defense-in-depth, layer 1).
 *
 *  - Everyone must be signed in (matcher excludes public routes below).
 *  - /api/admin/* — admin & root_admin only (403 JSON).
 *  - viewer role — read-only: mutating API calls are rejected (403 JSON).
 *  - BRAND ISOLATION: the `?brand=` / `?brandId=` query param is CLIENT-SUPPLIED
 *    and must never be trusted by route handlers. Here we validate it against the
 *    brands baked into the JWT (brand_members), reject cross-tenant access with
 *    403, and inject a TRUSTED `x-brand-id` header that routes read instead of the
 *    raw query. Any client-supplied x-brand-* header is stripped first (anti-spoof).
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as
      | { role?: string; brands?: string[]; allBrands?: boolean }
      | null;
    const role = token?.role ?? 'viewer';
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

    if (!isApi) return NextResponse.next();

    // ---- Brand tenant guard (API only) ----
    const allBrands = Boolean(token?.allBrands) || isAdmin;
    const allowed = token?.brands ?? [];
    const requested =
      req.nextUrl.searchParams.get('brand') ||
      req.nextUrl.searchParams.get('brandId') ||
      '';

    // Reject explicit cross-tenant access for non-super-admins.
    if (!allBrands && requested && !allowed.includes(requested)) {
      return NextResponse.json(
        { error: 'Forbidden — bạn không có quyền truy cập store này.' },
        { status: 403 }
      );
    }

    // Resolve the effective, TRUSTED brand for this request.
    // Non-admins never fall back to a hardcoded default (no more 'loveintea' leak).
    const effective = allBrands
      ? requested // admins may target any brand; empty means "route default"
      : requested || allowed[0] || '';

    // Rebuild request headers: strip any spoofed brand headers, inject trusted ones.
    const headers = new Headers(req.headers);
    headers.delete('x-brand-id');
    headers.delete('x-brand-all');
    headers.delete('x-user-brands');
    if (effective) headers.set('x-brand-id', effective);
    headers.set('x-brand-all', allBrands ? '1' : '0');
    headers.set('x-user-brands', allBrands ? '' : allowed.join(','));

    return NextResponse.next({ request: { headers } });
  },
  { callbacks: { authorized: ({ token }) => Boolean(token) } }
);

export const config = {
  matcher: [
    // Public (no auth): api/auth (NextAuth), api/webhooks (FB deauthorize),
    // api/images (FB/IG servers must fetch published images),
    // api/payment/webhook + momo-callback (bank/MoMo IPN callbacks)
    '/((?!api/auth|api/autofix|api/webhooks|api/images|api/payment/webhook|api/payment/momo-callback|login|about|_next/static|_next/image|favicon.ico|brand/|public/).*)',
  ],
};
