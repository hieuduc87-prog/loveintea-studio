import { NextRequest, NextResponse } from 'next/server';
import { enterBrandContext } from './tenant-context';

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
 *  query param only for internal/server contexts that bypass middleware.
 *
 *  KHÔNG CÓ DEFAULT TENANT (NT1). Bản cũ trả 'loveintea' cho admin thiếu brand
 *  "để dashboard cũ chạy được" — chính dòng đó là gốc của chuỗi sự cố lộ chéo:
 *  admin đứng ở store X, một call thiếu brand âm thầm đọc/ghi vào loveintea.
 *  Nay thiếu brand → '' → mọi query WHERE brand_id=? trả RỖNG (fail an toàn,
 *  không lộ), và route ghi phải tự chặn bằng requireBrand(). */
export function getBrandId(req: NextRequest): string {
  const header = req.headers.get('x-brand-id');
  const brand = header || req.nextUrl.searchParams.get('brand') || req.nextUrl.searchParams.get('brandId') || '';
  // P3 DB-per-tenant: gắn brand vào AsyncLocalStorage — mọi getDb() phía sau
  // của request này tự mở đúng DB brand (lib/tenant-context.ts).
  enterBrandContext(brand);
  if (process.env.DEBUG_TENANT === '1') console.log('[tenant-debug] getBrandId =', JSON.stringify(brand), 'header =', JSON.stringify(header));
  return brand;
}

/** Cổng BẮT BUỘC cho route ghi/tốn tiền: thiếu brand → 400 ngay, không đoán hộ.
 *  Usage:  const brandId = getBrandId(req);
 *          const denied = requireBrand(brandId); if (denied) return denied; */
export function requireBrand(brandId: string): NextResponse | null {
  if (brandId) return null;
  return NextResponse.json(
    { error: 'Thiếu brand cho thao tác này — tải lại trang rồi thử lại (hệ thống không tự chọn store thay bạn).' },
    { status: 400 }
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
  const ok = isAllBrands(req) || userBrands(req).includes(brandId);
  // Resource brand THẮNG context (route [id]/… có thể khác ?brand= của admin):
  // truy cập hợp lệ → chuyển ngữ cảnh DB sang brand của resource.
  if (ok) enterBrandContext(brandId);
  return ok;
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
