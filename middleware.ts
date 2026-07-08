import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Auth + role + BRAND-TENANT enforcement + host-based routing.
 *
 *  - Everyone must be signed in (matcher excludes public routes below).
 *  - /api/admin/* — admin & root_admin only (403 JSON).
 *  - viewer role — read-only: mutating API calls are rejected (403 JSON).
 *  - BRAND ISOLATION: the `?brand=` / `?brandId=` query param is CLIENT-SUPPLIED
 *    and must never be trusted by route handlers. We validate it against the JWT
 *    brands (brand_members), 403 on cross-tenant, and inject a TRUSTED `x-brand-id`
 *    header that routes read instead of the raw query (client x-brand-* stripped).
 *  - HOST ROUTING (BigAI MKT platform): one container serves two function
 *    subdomains — `crm.<domain>` = super-admin console (/platform), `app.<domain>`
 *    (or `autocontent.<domain>`) = the tenant product app (/). INERT on any other
 *    host (e.g. the current loveintea.wealthpsy.com), so it changes nothing until
 *    the bigaimkt subdomains point here.
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

    // ---- Host-based function routing (BigAI MKT) ----
    const host = (req.headers.get('host') || '').toLowerCase();
    const crmHost = host.startsWith('crm.');
    const appHost = host.startsWith('app.') || host.startsWith('autocontent.');
    const baseDomain = host.replace(/^[^.]+\./, '');
    const proto = req.nextUrl.protocol;
    const isBypass = pathname.startsWith('/api') || pathname.startsWith('/login') || pathname.startsWith('/_next');
    // The platform surface = the explicit /platform route OR anything on the crm host.
    const isPlatformSurface = pathname.startsWith('/platform') || (crmHost && !isBypass);

    if (pathname.startsWith('/api/admin') && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    // Platform (super-admin) console — admins only. Non-admins are pushed to the
    // tenant app (cross-host to app.<domain> when on the crm host).
    if (isPlatformSurface && !isAdmin) {
      const to = crmHost ? `${proto}//app.${baseDomain}/` : new URL('/', req.url).toString();
      return NextResponse.redirect(to);
    }

    if (isApi && isWrite && role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden — viewer role is read-only. Ask an admin to upgrade your role.' }, { status: 403 });
    }

    // On the tenant app host, /platform is not reachable — send to app root.
    if (appHost && pathname.startsWith('/platform')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // On the crm host, all app paths render the console.
    if (crmHost && !pathname.startsWith('/platform') && !isBypass) {
      return NextResponse.rewrite(new URL('/platform', req.url));
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
