import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Whitelist truy cập Platform Console — chỉ 2 email (không dùng role admin generic
// vì có nhiều admin brand khác không nên xem tổng platform). Hardcode để không đổi
// âm thầm qua env. Xem thêm lib/platform-access.ts cho helper server-side.
const PLATFORM_CONSOLE_EMAILS = new Set([
  'hieuduc87@gmail.com',
  'manhson.nguyen@gmail.com',
]);
// Cost/Revenue/Profit là DỮ LIỆU TÀI CHÍNH nội bộ — chỉ founder chính xem.
const COST_VIEWER_EMAILS = new Set(['hieuduc87@gmail.com']);

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
      | { role?: string; brands?: string[]; allBrands?: boolean; mustChangePassword?: boolean; email?: string }
      | null;
    const role = token?.role ?? 'viewer';
    const email = (token?.email || '').toLowerCase().trim();
    const { pathname } = req.nextUrl;
    const isApi = pathname.startsWith('/api/');
    const isAdmin = role === 'admin' || role === 'root_admin';
    const isPlatformAdmin = PLATFORM_CONSOLE_EMAILS.has(email);
    const isCostViewer = COST_VIEWER_EMAILS.has(email);
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    // ---- Host-based function routing (BigAI MKT) ----
    const host = (req.headers.get('host') || '').toLowerCase();
    // Bare/root marketing domain → public landing page (no auth).
    if (host === 'easycreativehub.com' || host === 'www.easycreativehub.com') {
      if (!pathname.startsWith('/landing') && !pathname.startsWith('/_next') && !isApi && !pathname.startsWith('/login')) {
        return NextResponse.rewrite(new URL('/landing', req.url));
      }
      return NextResponse.next();
    }
    const crmHost = host.startsWith('crm.') || host.startsWith('admin.');
    const appHost = host.startsWith('app.') || host.startsWith('autocontent.');
    const baseDomain = host.replace(/^[^.]+\./, '');
    const proto = req.nextUrl.protocol;

    // ── DOMAIN RIÊNG TỪNG STORE: <slug>.easycreativehub.com ────────────────
    // Store nằm trong URL = không còn "đứng nhầm nhà": mở link nào là ở store
    // đó, F5 vẫn thế, hai tab hai store không đá nhau. Host do TLS/tunnel xác
    // thực nên đáng tin hơn mọi state phía client.
    // Ràng buộc: subdomain label == brand id (createStore đặt id=slug).
    const RESERVED_SUBS = new Set(['app', 'admin', 'crm', 'www', 'autocontent', 'landing', 'api', 'mail']);
    const hostLabel = host.endsWith('.easycreativehub.com')
      ? host.slice(0, -'.easycreativehub.com'.length) : '';
    const storeHost = hostLabel && !hostLabel.includes('.') && !RESERVED_SUBS.has(hostLabel)
      ? hostLabel : '';
    const isBypass = pathname.startsWith('/api') || pathname.startsWith('/login') || pathname.startsWith('/_next');
    // The platform surface = the explicit /platform route OR anything on the crm host.
    const isPlatformSurface = pathname.startsWith('/platform') || (crmHost && !isBypass);

    // Mật khẩu tạm: chặn mọi TRANG cho tới khi đổi mật khẩu (API vẫn chạy để
    // /api/account/password và /api/auth hoạt động; đổi xong flag clear ngay).
    if (token?.mustChangePassword && !isBypass && !pathname.startsWith('/change-password')) {
      return NextResponse.redirect(new URL('/change-password', req.url));
    }

    // Platform admin routes — chỉ 2 email whitelist (không phải "role admin generic" — vì
    // admin của brand khác không nên xem/tạo store, mời user, v.v. cấp platform)
    if (pathname.startsWith('/api/admin') && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Forbidden — chỉ founder (hieuduc87/manhson) truy cập được Platform Console.' }, { status: 403 });
    }
    // Cost/Revenue/P&L — chỉ founder chính (hieuduc87). /api/cost hoàn toàn cấm cho non-cost-viewer.
    // /api/admin/dashboard vẫn cho manhson (thấy shops/users/alerts NON-COST) — route tự strip cost fields khi caller không phải cost viewer.
    if (pathname.startsWith('/api/cost') && !isCostViewer) {
      return NextResponse.json({ error: 'Forbidden — Cost/Revenue là dữ liệu nội bộ, chỉ founder chính xem được.' }, { status: 403 });
    }

    // Platform (super-admin) console — chỉ 2 email whitelist. Non-whitelist → app tenant.
    if (isPlatformSurface && !isPlatformAdmin) {
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

    const allBrands = Boolean(token?.allBrands) || isAdmin;
    const allowed = token?.brands ?? [];

    // Trên host store: người không có quyền store đó KHÔNG được vào trang —
    // đuổi về app. (chọn store của mình) thay vì hiện UI trống gây hiểu lầm.
    if (storeHost && !isApi && !isBypass && !allBrands && !allowed.includes(storeHost)) {
      return NextResponse.redirect(`${proto}//app.${baseDomain}/`);
    }

    if (!isApi) return NextResponse.next();

    // ---- Brand tenant guard (API only) ----
    const queryBrand =
      req.nextUrl.searchParams.get('brand') ||
      req.nextUrl.searchParams.get('brandId') ||
      '';
    // HOST THẮNG QUERY: trên host store, ?brand= khác host là mâu thuẫn — chặn
    // thẳng thay vì im lặng chọn một bên (đó là cách sự cố "đứng nhầm nhà" cũ
    // lách vào). Cùng giá trị hoặc thiếu query → pin theo host.
    if (storeHost && queryBrand && queryBrand !== storeHost) {
      return NextResponse.json(
        { error: `Mâu thuẫn store: đang ở ${storeHost} nhưng yêu cầu ${queryBrand}. Tải lại trang.` },
        { status: 409 }
      );
    }
    const requested = storeHost || queryBrand;

    // Reject explicit cross-tenant access for non-super-admins.
    if (!allBrands && requested && !allowed.includes(requested)) {
      return NextResponse.json(
        { error: 'Forbidden — bạn không có quyền truy cập store này.' },
        { status: 403 }
      );
    }

    // ── NT2: KHÔNG CÓ TENANT MẶC ĐỊNH ────────────────────────────────────
    // Thao tác GHI mà không xác định được chủ thì TỪ CHỐI, không đoán hộ.
    // (Gốc của 4/6 sự cố tenant tháng 7: admin ghi không kèm ?brand= → hệ rơi
    //  về 'loveintea' → dữ liệu khách này ghi sang khách khác.)
    // Route PLATFORM (không thuộc brand nào) được miễn.
    const PLATFORM_PATHS = [
      '/api/auth', '/api/admin', '/api/platform', '/api/kanban', '/api/autofix',
      '/api/webhooks', '/api/payment', '/api/account', '/api/upload', '/api/brands',
      '/api/fb-setup', '/api/settings', '/api/health', '/api/inbox',
    ];
    const isPlatformPath = PLATFORM_PATHS.some(p => pathname.startsWith(p));
    if (isWrite && allBrands && !requested && !isPlatformPath) {
      console.warn(`[tenant-guard] CHẶN ghi không rõ brand: ${req.method} ${pathname}`);
      return NextResponse.json(
        { error: 'Thiếu brand cho thao tác này — tải lại trang rồi thử lại (hệ thống không tự chọn brand thay bạn).' },
        { status: 400 }
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
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Public marketing surfaces: the bare domain and the /landing route
        // render without a session; everything else requires sign-in.
        const host = (req.headers.get('host') || '').toLowerCase();
        if (host === 'easycreativehub.com' || host === 'www.easycreativehub.com') return true;
        if (req.nextUrl.pathname.startsWith('/landing')) return true;
        return Boolean(token);
      },
    },
  }
);

export const config = {
  matcher: [
    // Public (no auth): api/auth (NextAuth), api/webhooks (FB deauthorize),
    // api/images (FB/IG servers must fetch published images),
    // api/payment/webhook + momo-callback (bank/MoMo IPN callbacks)
    '/((?!api/auth|api/autofix|api/webhooks|api/images|api/payment/webhook|api/payment/momo-callback|login|about|_next/static|_next/image|favicon.ico|brand/|public/).*)',
  ],
};
