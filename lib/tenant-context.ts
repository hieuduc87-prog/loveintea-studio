/**
 * Tenant context — brand của request/tác vụ hiện tại, mang bằng AsyncLocalStorage.
 * (P3 DB-per-tenant, học mô hình dlsamz — docs/tenant-isolation-vs-dlsamz.md)
 *
 * - Route handler: brand-guard `getBrandId()/canAccessBrand()` tự enterBrandContext —
 *   mọi getDb() phía dưới mở đúng DB của brand, không truyền brandId bằng tay.
 * - Tác vụ nền (scheduler, provisioning, script): bọc từng brand trong runWithBrand().
 * - Không có context → getDb() trả GLOBAL DB (chỉ còn bảng platform sau migration).
 *
 * File này KHÔNG import db (tránh vòng); db.ts import ngược lại.
 */
import { AsyncLocalStorage } from 'async_hooks';

const store = new AsyncLocalStorage<{ brandId: string }>();

/** Slug hợp lệ làm tên thư mục — chống path traversal (luật dlsamz). */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export function isValidBrandSlug(id: string): boolean {
  return SLUG_RE.test(id);
}

export function currentBrandId(): string {
  return store.getStore()?.brandId || '';
}

/** Gắn brand vào ngữ cảnh async hiện tại (phần còn lại của request kế thừa).
 *  Brand không hợp lệ → bỏ qua (giữ context cũ) — không bao giờ throw ở guard. */
export function enterBrandContext(brandId: string | null | undefined): void {
  if (brandId && isValidBrandSlug(brandId)) store.enterWith({ brandId });
}

/** Chạy fn trong ngữ cảnh 1 brand — dùng cho scheduler/worker/provisioning. */
export function runWithBrand<T>(brandId: string, fn: () => T): T {
  if (!isValidBrandSlug(brandId)) throw new Error(`INVALID_BRAND_SLUG: ${brandId}`);
  return store.run({ brandId }, fn);
}
