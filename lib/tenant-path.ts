/**
 * ĐƯỜNG DẪN FILE THEO KHÁCH (NT4 — quy hoạch đa-brand).
 *
 * Trước: mọi brand đổ chung vào `data/images/` → không thể xoá / backup / tính
 * dung lượng theo khách, và một lần dọn nhầm là mất của tất cả.
 * Sau: file MỚI ghi vào `data/tenants/<brandId>/<kind>/`; file CŨ vẫn đọc được
 * ở chỗ cũ (đọc 2 nơi) — không phải di dời gấp, không gãy link đang chạy.
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR, IMAGES_DIR } from './video/ffmpeg';

export type TenantFileKind = 'images' | 'video' | 'library' | 'fonts' | 'tmp';

/** Thư mục của khách cho một loại file (tự tạo nếu chưa có). */
export function tenantDir(brandId: string, kind: TenantFileKind): string {
  const safe = String(brandId || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown';
  const dir = path.join(DATA_DIR, 'tenants', safe, kind);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Nơi GHI file mới của khách. */
export function tenantFilePath(brandId: string, kind: TenantFileKind, filename: string): string {
  return path.join(tenantDir(brandId, kind), path.basename(filename));
}

/**
 * Nơi ĐỌC file: ưu tiên thư mục khách, không có thì rơi về kho chung (file cũ).
 * Trả null nếu không tồn tại ở cả hai nơi.
 */
export function resolveTenantFile(brandId: string, kind: TenantFileKind, filename: string): string | null {
  const base = path.basename(filename);
  const own = path.join(DATA_DIR, 'tenants', String(brandId || '').replace(/[^a-zA-Z0-9_-]/g, ''), kind, base);
  if (fs.existsSync(own)) return own;
  const legacy = path.join(IMAGES_DIR, base);          // kho chung cũ
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

/** Dung lượng khách đang dùng (byte) — cho hạn mức / hoá đơn. */
export function tenantDiskUsage(brandId: string): { bytes: number; files: number } {
  const root = path.join(DATA_DIR, 'tenants', String(brandId || '').replace(/[^a-zA-Z0-9_-]/g, ''));
  let bytes = 0, files = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { try { bytes += fs.statSync(p).size; files++; } catch { /* file vừa bị xoá */ } }
    }
  };
  walk(root);
  return { bytes, files };
}
