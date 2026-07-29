#!/usr/bin/env node
/**
 * TENANT GUARD CHECK — chặn TÁI DIỄN cả lớp lỗi đa-brand ngay từ lúc viết code.
 * Chạy: npm run check:tenant   (nên gắn vào CI / trước khi deploy)
 *
 * Bắt 3 lớp lỗi đã trả giá thật:
 *  1. Bảng mới thiếu `brand_id` mà không khai báo là PLATFORM  (image_library, blog_posts 21/07)
 *  2. Ghi `settings` bằng key toàn cục không mang brand         (brand voice 29/07)
 *  3. Ghi credential ngoài vào nơi dùng chung                   (token FB bị đè 29/07)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const problems = [];
const notes = [];

/** Bảng CỐ Ý dùng chung toàn hệ — thêm vào đây phải có lý do rõ ràng. */
const PLATFORM_TABLES = new Set([
  'auth_users', 'auth_accounts', 'auth_sessions', 'auth_verification_tokens',
  'brands', 'settings', 'payment_plans', 'bank_transfers', 'subscriptions', 'momo_payments',
  'fb_connections', 'fb_pages', 'batch_runs', 'image_jobs', 'inbox_messages', 'publish_log',
  'asset_tags', 'content_log_assets', 'post_tags', 'knowledge_log', 'brand_settings',
]);

/** Key `settings` toàn cục được phép (cấu hình hệ, không phải dữ liệu khách). */
const GLOBAL_SETTING_KEYS = new Set([
  'scheduler_last_tick', 'fb_token_health', 'unit_costs', 'stories_rotation',
  'ai_text_fallback_at', 'FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN', 'FB_PAGE_NAME',
  'IG_BUSINESS_ACCOUNT_ID',
]);

// ── 1. Schema: bảng TENANT phải có brand_id ────────────────────────────────
const dbTs = fs.readFileSync(path.join(ROOT, 'lib/db.ts'), 'utf8');
// brand_id có thể được thêm SAU bằng ALTER TABLE (migration) — phải tính cả,
// nếu không guard báo nhầm chính những bảng đã fix (posts, image_library…).
const alteredWithBrand = new Set(
  [...dbTs.matchAll(/ALTER TABLE (\w+) ADD COLUMN brand_id/g)].map(m => m[1])
);
for (const m of dbTs.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([^;]*?)\)\s*;/gs)) {
  const [, table, body] = m;
  if (PLATFORM_TABLES.has(table) || alteredWithBrand.has(table)) continue;
  if (!/\bbrand_id\b/.test(body)) {
    problems.push(
      `[schema] Bảng "${table}" không có cột brand_id.\n` +
      `         → Nếu là dữ liệu của khách: thêm brand_id + lọc theo tenant ở mọi truy vấn.\n` +
      `         → Nếu cố ý dùng chung toàn hệ: khai báo trong PLATFORM_TABLES của file này (kèm lý do).`
    );
  }
}

// ── 2. settings: cấm key toàn cục cho dữ liệu khách ────────────────────────
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'scripts'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
};
const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);

  // INSERT/REPLACE INTO settings ... VALUES ('key_literal', ...)
  for (const m of src.matchAll(/INTO settings[^)]*\)\s*VALUES\s*\(\s*'([^']+)'/g)) {
    const key = m[1];
    if (!GLOBAL_SETTING_KEYS.has(key) && !key.includes(':')) {
      problems.push(
        `[settings] ${rel}: ghi key toàn cục '${key}'.\n` +
        `           → Dữ liệu của khách phải dùng key kèm brand: \`${key}:\${brandId}\`.\n` +
        `           → Nếu là cấu hình hệ: thêm vào GLOBAL_SETTING_KEYS.`
      );
    }
  }

  // Credential ngoài ghi vào settings (đã gây vụ đè token FB)
  if (/upsertSetting\([^)]*'(FB_PAGE_ACCESS_TOKEN|IG_BUSINESS_ACCOUNT_ID)'/.test(src)
      && !/brandId|bid\s*===\s*'loveintea'|cbBrand/.test(src)) {
    problems.push(
      `[credential] ${rel}: ghi token kênh vào settings dùng chung mà không kiểm tra brand.\n` +
      `             → Credential của khách phải lưu bảng channels theo brand (mã hoá).`
    );
  }
}

// ── 3. Thống kê tham khảo: route mutating không đụng tới brand ─────────────
let routesNoBrand = 0;
for (const f of files.filter(f => f.includes('/app/api/') && f.endsWith('route.ts'))) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/export async function (POST|PATCH|PUT|DELETE)/.test(src)) continue;
  if (/getBrandId|canAccessBrand|assertResourceBrand|brand_id|brandId/.test(src)) continue;
  routesNoBrand++;
  notes.push(`[xem lại] ${path.relative(ROOT, f)}: route có thao tác GHI nhưng không nhắc gì tới brand`);
}

// ── Kết quả ────────────────────────────────────────────────────────────────
if (notes.length) {
  console.log(`\nℹ️  ${notes.length} route cần xem lại (không chặn build):`);
  notes.slice(0, 15).forEach(n => console.log('   ' + n));
  if (notes.length > 15) console.log(`   … và ${notes.length - 15} route nữa`);
}

if (problems.length) {
  console.error(`\n❌ TENANT GUARD: ${problems.length} vi phạm — sửa trước khi deploy\n`);
  problems.forEach(p => console.error(p + '\n'));
  process.exit(1);
}
console.log(`\n✅ TENANT GUARD: không có vi phạm (đã soi ${files.length} file, ${routesNoBrand} route ghi cần xem lại)`);
