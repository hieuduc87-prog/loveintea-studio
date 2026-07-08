import { NextRequest, NextResponse } from 'next/server';

/**
 * Brand-tenant guard helpers (defense-in-depth, layer 2).
 *
 * The middleware (layer 1) validates the client-supplied `?brand=` param against
 * the user's brand_members and injects TRUSTED headers:
 *   - x-brand-id     the resolved, authorized brand for this request
 *   - x-brand-all    '1' if the caller is a super-admin (may access every brand)
 *   - x-user-brands  csv of brand ids the caller may access (empty for admins)
 *
 * Route handlers MUST read the brand from here, never from the raw query param.
 */

/** The trusted brand id for this request (set by middleware). Falls back to the
 *  query param only for internal/server contexts that bypass middleware. */
export function getBrandId(req: NextRequest): string {
  return (
    req.headers.get('x-brand-id') ||
    req.nextUrl.searchParams.get('brand') ||
    req.nextUrl.searchParams.get('brandId') ||
    ''
  );
}

export function isAllBrands(req: NextRequest): boolean {
  return req.headers.get('x-brand-all') === '1';
}

/** Brand ids the caller may access (empty for super-admins — see isAllBrands). */
export function userBrands(req: NextRequest): string[] {
  const raw = req.headers.get('x-user-brands') || '';
  return raw ? raw.split(',').filter(Boolean) : [];
}

/** True if the caller may access `brandId`. Super-admins may access any brand. */
export function canAccessBrand(req: NextRequest, brandId: string | null | undefined): boolean {
  if (!brandId) return false;
  if (isAllBrands(req)) return true;
  return userBrands(req).includes(brandId);
}

/**
 * Ownership guard for `[id]` routes: pass the resource's own brand_id (loaded
 * from the DB). Returns a 403 NextResponse if the caller may not touch it, else
 * null (proceed). Usage:
 *   const denied = assertResourceBrand(req, row.brand_id);
 *   if (denied) return denied;
 */
export function assertResourceBrand(
  req: NextRequest,
  resourceBrandId: string | null | undefined
): NextResponse | null {
  if (canAccessBrand(req, resourceBrandId)) return null;
  return NextResponse.json(
    { error: 'Forbidden — resource thuộc store khác.' },
    { status: 403 }
  );
}

/** Require a resolved brand or return a 400. Use in list/create routes that need
 *  a brand context. */
export function requireBrandId(req: NextRequest): { brandId: string } | { error: NextResponse } {
  const brandId = getBrandId(req);
  if (!brandId) {
    return {
      error: NextResponse.json(
        { error: 'Bad request — thiếu brand context (chưa gán store cho tài khoản?).' },
        { status: 400 }
      ),
    };
  }
  return { brandId };
}
