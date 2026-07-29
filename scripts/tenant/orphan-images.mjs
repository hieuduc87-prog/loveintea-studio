#!/usr/bin/env node
/**
 * ẢNH MỒ CÔI — liệt kê / cách ly / khôi phục file không còn ai tham chiếu.
 *
 * KHÔNG BAO GIỜ xoá thẳng (luật xoá an toàn): file được CHUYỂN vào
 * data/_quarantine/<ngày>/ để còn đường lùi; xoá hẳn là bước riêng do người quyết.
 *
 *   node orphan-images.mjs list                 → thống kê (mặc định, không đụng file)
 *   node orphan-images.mjs quarantine [--yes]   → chuyển ảnh mồ côi vào khu cách ly
 *   node orphan-images.mjs restore <ngày>       → trả lại toàn bộ từ khu cách ly
 *   node orphan-images.mjs purge <ngày> --yes   → xoá hẳn khu cách ly (sau khi yên tâm)
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const IMAGES = path.join(DATA_DIR, 'images');
const QUAR = path.join(DATA_DIR, '_quarantine');
const KEEP_DAYS = 3; // file mới hơn 3 ngày KHÔNG đụng (có thể đang được tạo/gắn)

function referencedFiles(db) {
  const refs = new Set();
  const add = (v) => {
    if (!v) return;
    const m = String(v).match(/[\w.-]+\.(png|jpg|jpeg|webp|mp4|mp3|gif)/gi);
    if (m) m.forEach(f => refs.add(f));
  };
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).all().map(r => r.name);
  for (const t of tables) {
    try { for (const row of db.prepare(`SELECT * FROM ${t}`).all()) Object.values(row).forEach(add); }
    catch { /* bảng lạ */ }
  }
  // NGOÀI DB: quét MỌI file text trong data/ (kanban card.json, brand-library,
  // references, flows, brand-docs…). Bản cũ chỉ đọc kanban → thư mục nào mới thêm
  // sau này là mù, ảnh còn dùng bị coi là mồ côi. Thà quét thừa còn hơn xoá oan.
  const SKIP = new Set(['images', 'backups', '_quarantine', 'video-cache', 'video-tmp', 'fonts', 'tenants']);
  const TEXT = /\.(json|txt|md|jsonl|csv|ya?ml)$/i;
  const walk = (dir, depth = 0) => {
    if (depth > 6) return;
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth > 0 || !SKIP.has(e.name)) walk(p, depth + 1); continue; }
      if (!TEXT.test(e.name)) continue;
      try { if (fs.statSync(p).size < 20_000_000) add(fs.readFileSync(p, 'utf8')); } catch { /* */ }
    }
  };
  walk(DATA_DIR);
  return refs;
}

function scan() {
  const db = new Database(path.join(DATA_DIR, 'studio.db'), { readonly: true });
  const refs = referencedFiles(db);
  db.close();
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  const orphans = [];
  let usedCount = 0, recentSkip = 0;
  for (const f of fs.readdirSync(IMAGES).filter(x => !x.startsWith('.'))) {
    if (refs.has(f)) { usedCount++; continue; }
    const p = path.join(IMAGES, f);
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (st.mtimeMs > cutoff) { recentSkip++; continue; }   // mới quá — để yên
    orphans.push({ f, bytes: st.size });
  }
  return { orphans, usedCount, recentSkip };
}

const [cmd, arg] = process.argv.slice(2);
const yes = process.argv.includes('--yes');
const gb = (b) => (b / 1024 / 1024 / 1024).toFixed(2);

if (!cmd || cmd === 'list') {
  const { orphans, usedCount, recentSkip } = scan();
  const total = orphans.reduce((s, o) => s + o.bytes, 0);
  console.log(`Đang dùng: ${usedCount} file`);
  console.log(`Bỏ qua vì mới (<${KEEP_DAYS} ngày): ${recentSkip} file`);
  console.log(`MỒ CÔI: ${orphans.length} file = ${gb(total)} GB`);
  console.log('Ví dụ:', orphans.slice(0, 5).map(o => o.f).join(', '));
} else if (cmd === 'quarantine') {
  const { orphans } = scan();
  if (!yes) { console.log(`Sẽ chuyển ${orphans.length} file vào khu cách ly. Thêm --yes để thực hiện.`); process.exit(0); }
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(QUAR, day);
  fs.mkdirSync(dir, { recursive: true });
  let moved = 0, bytes = 0;
  for (const o of orphans) {
    try { fs.renameSync(path.join(IMAGES, o.f), path.join(dir, o.f)); moved++; bytes += o.bytes; } catch { /* */ }
  }
  console.log(`Đã cách ly ${moved} file (${gb(bytes)} GB) → ${dir}`);
  console.log(`Khôi phục: node orphan-images.mjs restore ${day}`);
} else if (cmd === 'restore') {
  const dir = path.join(QUAR, String(arg || ''));
  let back = 0;
  for (const f of fs.readdirSync(dir)) { try { fs.renameSync(path.join(dir, f), path.join(IMAGES, f)); back++; } catch { /* */ } }
  console.log(`Đã trả lại ${back} file từ ${dir}`);
} else if (cmd === 'purge') {
  if (!yes) { console.log('Cần --yes để xoá hẳn khu cách ly.'); process.exit(1); }
  const dir = path.join(QUAR, String(arg || ''));
  const n = fs.readdirSync(dir).length;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Đã xoá hẳn ${n} file trong ${dir}`);
} else {
  console.log('Lệnh: list | quarantine [--yes] | restore <ngày> | purge <ngày> --yes');
}
