#!/usr/bin/env node
/**
 * TENANT DB TOOLKIT — export / restore / verify DỮ LIỆU TỪNG BRAND.
 *
 * Vì sao có file này: backup toàn hệ chỉ cho phép khôi phục CẢ CHÙM — một brand
 * hỏng dữ liệu mà restore là đè luôn các brand khác (mất dữ liệu khách vô can).
 * Đây cũng là bước 1 của lộ trình tách DB riêng từng brand: file .db xuất ra ở
 * đây CHÍNH LÀ tenant database (đủ schema + chỉ dữ liệu của brand đó).
 *
 * Dùng:
 *   node tenant-db.mjs list                      → brand + số dòng từng bảng
 *   node tenant-db.mjs export <brandId> [out.db] → xuất DB riêng của brand
 *   node tenant-db.mjs verify <file.db> <brandId>→ kiểm tra file xuất có đúng/đủ
 *   node tenant-db.mjs restore <file.db> <brandId> [--yes]
 *                                                → nạp lại CHỈ brand đó vào DB chính
 *   node tenant-db.mjs export-all [outDir]       → xuất tất cả brand (dùng cho cron)
 *
 * An toàn: restore chạy trong MỘT transaction, chỉ xoá/ghi đúng brand truyền vào,
 * và tự dump bản "trước khi restore" ra file .pre-restore.db để có đường lùi.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const MAIN_DB = process.env.MAIN_DB || path.join(DATA_DIR, 'studio.db');

/** Bảng PLATFORM — dùng chung toàn hệ, KHÔNG thuộc brand nào, không export. */
const PLATFORM_TABLES = new Set([
  'auth_users', 'auth_accounts', 'auth_sessions', 'auth_verification_tokens',
  'brands', 'payment_plans', 'bank_transfers', 'subscriptions', 'momo_payments',
  'fb_connections', 'fb_pages', 'batch_runs', 'image_jobs', 'inbox_messages',
]);

/** settings: chỉ key có tiền tố `<prefix>:<brandId>` mới thuộc brand. */
const TENANT_SETTING_PREFIXES = ['brand_voice'];

function openMain(readonly = true) {
  if (!fs.existsSync(MAIN_DB)) throw new Error(`Không thấy DB chính: ${MAIN_DB}`);
  return new Database(MAIN_DB, { readonly });
}

function tenantTables(db) {
  return db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).all()
    .map(r => r.name)
    .filter(t => !PLATFORM_TABLES.has(t))
    .filter(t => db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === 'brand_id'));
}

function ddlOf(db, table) {
  const r = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  return r?.sql || null;
}

function indexesOf(db, table) {
  return db.prepare(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`)
    .all(table).map(r => r.sql);
}

// ── EXPORT ────────────────────────────────────────────────────────────────
function exportBrand(brandId, outFile) {
  const src = openMain(true);
  const brand = src.prepare('SELECT id, name FROM brands WHERE id=?').get(brandId);
  if (!brand) throw new Error(`Brand không tồn tại: ${brandId}`);

  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  const dst = new Database(outFile);
  dst.pragma('journal_mode = WAL');
  // better-sqlite3 BẬT foreign_keys mặc định (khác sqlite3 CLI). File xuất là ảnh
  // chụp dữ liệu 1 brand — các FK trỏ sang bảng platform (users…) cố ý để trống,
  // nên phải tắt kiểm tra FK khi nạp.
  dst.pragma('foreign_keys = OFF');

  const tables = tenantTables(src);
  const report = { brand: brandId, at: new Date().toISOString(), tables: {}, settings: 0 };

  // Tạo ĐẦY ĐỦ schema (mọi bảng + index) để khoá ngoại/index có chỗ bám —
  // file xuất vì thế là một DB hoàn chỉnh, chính là tenant DB tương lai.
  // Dữ liệu thì CHỈ nạp của brand này.
  const allTables = src.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL`
  ).all();
  for (const t of allTables) { try { dst.exec(t.sql); } catch { /* bảng lạ, bỏ qua */ } }
  for (const ix of src.prepare(
    `SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL`
  ).all()) { try { dst.exec(ix.sql); } catch { /* index tuỳ chọn */ } }

  // brands: chỉ giữ đúng dòng của brand này (restore biết chủ + hiển thị tên)
  const b = src.prepare('SELECT * FROM brands WHERE id=?').get(brandId);
  if (b) {
    const cols = Object.keys(b);
    dst.prepare(`INSERT OR REPLACE INTO brands (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(cols.map(c => b[c]));
  }

  dst.exec('BEGIN');
  for (const t of tables) {
    const rows = src.prepare(`SELECT * FROM ${t} WHERE brand_id = ?`).all(brandId);
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      const stmt = dst.prepare(
        `INSERT INTO ${t} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      );
      for (const r of rows) stmt.run(cols.map(c => r[c]));
    }
    report.tables[t] = rows.length;
  }

  // settings thuộc brand (brand_voice:<id>, …)
  {
    const stmt = dst.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)');
    for (const p of TENANT_SETTING_PREFIXES) {
      const rows = src.prepare('SELECT key, value, updated_at FROM settings WHERE key = ?').all(`${p}:${brandId}`);
      for (const r of rows) { stmt.run(r.key, r.value, r.updated_at); report.settings++; }
    }
  }
  dst.exec('COMMIT');

  // Manifest để verify/khôi phục truy vết được
  dst.exec(`CREATE TABLE IF NOT EXISTS _tenant_manifest (k TEXT PRIMARY KEY, v TEXT)`);
  dst.prepare('INSERT OR REPLACE INTO _tenant_manifest (k,v) VALUES (?,?)').run('manifest', JSON.stringify(report));
  dst.close(); src.close();
  return report;
}

// ── VERIFY ────────────────────────────────────────────────────────────────
function verifyExport(file, brandId) {
  const src = openMain(true);
  const dst = new Database(file, { readonly: true });
  const problems = [];
  let checked = 0;

  for (const t of tenantTables(src)) {
    const expect = src.prepare(`SELECT COUNT(*) c FROM ${t} WHERE brand_id=?`).get(brandId).c;
    let got = 0, foreign = 0;
    try {
      got = dst.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
      foreign = dst.prepare(`SELECT COUNT(*) c FROM ${t} WHERE brand_id <> ?`).get(brandId).c;
    } catch { problems.push(`${t}: thiếu bảng trong file xuất`); continue; }
    checked++;
    if (got !== expect) problems.push(`${t}: ${got} dòng ≠ ${expect} dòng ở DB chính`);
    if (foreign > 0) problems.push(`🔴 ${t}: LỌT ${foreign} dòng của brand khác`);
  }
  src.close(); dst.close();
  return { ok: problems.length === 0, checked, problems };
}

// ── RESTORE (chỉ 1 brand) ─────────────────────────────────────────────────
function restoreBrand(file, brandId, confirmed) {
  if (!confirmed) throw new Error('Cần cờ --yes để xác nhận ghi đè dữ liệu brand này');
  const v = verifyExport(file, brandId);
  if (v.problems.some(p => p.startsWith('🔴'))) {
    throw new Error(`File xuất có dữ liệu brand khác — DỪNG: ${v.problems.join('; ')}`);
  }

  // Đường lùi: xuất bản hiện tại của brand TRƯỚC khi ghi đè
  const pre = file.replace(/\.db$/, '') + `.pre-restore-${Date.now()}.db`;
  exportBrand(brandId, pre);

  const main = new Database(MAIN_DB);
  main.pragma('foreign_keys = OFF'); // nạp lại ảnh chụp: bỏ qua FK sang bảng platform
  const src = new Database(file, { readonly: true });
  const tables = tenantTables(main);
  const summary = { restored: {}, backupTrước: pre };

  const tx = main.transaction(() => {
    for (const t of tables) {
      let rows = [];
      try { rows = src.prepare(`SELECT * FROM ${t}`).all(); } catch { continue; }
      main.prepare(`DELETE FROM ${t} WHERE brand_id = ?`).run(brandId);
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const stmt = main.prepare(
          `INSERT INTO ${t} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        );
        for (const r of rows) stmt.run(cols.map(c => r[c]));
      }
      summary.restored[t] = rows.length;
    }
    try {
      const st = src.prepare('SELECT key, value, updated_at FROM settings').all();
      const up = main.prepare('INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,?)');
      for (const r of st) if (r.key.endsWith(`:${brandId}`)) up.run(r.key, r.value, r.updated_at);
    } catch { /* file cũ không có settings */ }
  });
  tx();
  main.close(); src.close();
  return summary;
}

// ── CLI ───────────────────────────────────────────────────────────────────
const [cmd, a1, a2] = process.argv.slice(2);
try {
  if (cmd === 'list') {
    const db = openMain(true);
    const brands = db.prepare('SELECT id, name FROM brands ORDER BY id').all();
    const tables = tenantTables(db);
    for (const b of brands) {
      const counts = tables.map(t => [t, db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE brand_id=?`).get(b.id).c])
        .filter(([, c]) => c > 0);
      const total = counts.reduce((s, [, c]) => s + c, 0);
      console.log(`\n${b.id} (${b.name}) — ${total} dòng / ${counts.length} bảng`);
      console.log('  ' + counts.map(([t, c]) => `${t}:${c}`).join(' '));
    }
    db.close();
  } else if (cmd === 'export') {
    const out = a2 || path.join(DATA_DIR, 'backups', 'tenants', `${a1}-${new Date().toISOString().slice(0, 10)}.db`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = exportBrand(a1, out);
    const v = verifyExport(out, a1);
    console.log(JSON.stringify({ out, size: fs.statSync(out).size, ...r, verify: v }, null, 1));
    if (!v.ok) process.exit(2);
  } else if (cmd === 'export-all') {
    const dir = a1 || path.join(DATA_DIR, 'backups', 'tenants');
    fs.mkdirSync(dir, { recursive: true });
    const db = openMain(true);
    const brands = db.prepare('SELECT id FROM brands ORDER BY id').all().map(b => b.id);
    db.close();
    let bad = 0;
    for (const b of brands) {
      const out = path.join(dir, `${b}-${new Date().toISOString().slice(0, 10)}.db`);
      const r = exportBrand(b, out);
      const v = verifyExport(out, b);
      const rows = Object.values(r.tables).reduce((s, n) => s + n, 0);
      console.log(`${v.ok ? '✅' : '❌'} ${b}: ${rows} dòng → ${path.basename(out)}${v.ok ? '' : ' | ' + v.problems.join('; ')}`);
      if (!v.ok) bad++;
    }
    process.exit(bad ? 2 : 0);
  } else if (cmd === 'verify') {
    const v = verifyExport(a1, a2);
    console.log(JSON.stringify(v, null, 1));
    process.exit(v.ok ? 0 : 2);
  } else if (cmd === 'restore') {
    const r = restoreBrand(a1, a2, process.argv.includes('--yes'));
    console.log(JSON.stringify(r, null, 1));
  } else {
    console.log('Lệnh: list | export <brand> [out] | export-all [dir] | verify <file> <brand> | restore <file> <brand> --yes');
    process.exit(1);
  }
} catch (e) {
  console.error('LỖI:', e.message);
  process.exit(1);
}
