/**
 * BRAND_LIBRARY — khung folder chuẩn theo Phiếu B của đề bài Creative Hub.
 * Nằm trong DATA_DIR (volume /opt/loveintea/data trên prod) — assets vĩnh viễn,
 * KHÔNG BAO GIỜ bị cron cleanup đụng tới (Cron/Cleanup Safety Rule).
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './ffmpeg';
import { getDb } from '../db';

export const LIB_DIRS = [
  'PACKSHOTS', 'LOGO', 'MOTION', 'PROMPTS', 'AUDIO/SFX/AI_ASMR', 'AUDIO/BGM', 'TEMPLATES', 'RULES',
] as const;

export function brandLibRoot(brandId: string): string {
  return path.join(DATA_DIR, 'brand-library', brandId);
}

export function referencesRoot(brandId: string, templateKey: string): string {
  return path.join(DATA_DIR, 'references', brandId, templateKey.replace(/_v\d+$/, '_reels'));
}

/** Cache clip AI theo hash — tái dùng giữa versions + resume sau fail. */
export function clipCacheRoot(): string {
  return path.join(DATA_DIR, 'video-cache');
}

export function ensureBrandLibrary(brandId: string): string {
  const root = brandLibRoot(brandId);
  for (const d of LIB_DIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
  fs.mkdirSync(clipCacheRoot(), { recursive: true });
  return root;
}

export function readLibJson<T>(brandId: string, rel: string): T | null {
  try { return JSON.parse(fs.readFileSync(path.join(brandLibRoot(brandId), rel), 'utf8')) as T; }
  catch { return null; }
}

export function writeLibJson(brandId: string, rel: string, data: unknown): void {
  const f = path.join(brandLibRoot(brandId), rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

/** Packshot ưu tiên: BRAND_LIBRARY (nhân viên nộp bản approved) → ảnh sản phẩm
 *  trong repo/products (stand-in đã duyệt dùng trong app). Trả path tuyệt đối. */
export function resolvePackshot(brandId: string, skuCode: string, productSlug: string): string | null {
  const libDir = path.join(brandLibRoot(brandId), 'PACKSHOTS', skuCode);
  try {
    const f = fs.readdirSync(libDir).find(x => x.toLowerCase().endsWith('.png'));
    if (f) return path.join(libDir, f);
  } catch { /* chưa nộp */ }
  const db = getDb();
  const prod = db.prepare('SELECT image_url FROM products WHERE brand_id=? AND slug=?').get(brandId, productSlug) as { image_url?: string } | undefined;
  if (prod?.image_url?.startsWith('/')) {
    const f = path.join(process.cwd(), 'public', prod.image_url);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

export function resolveLogo(brandId: string): string | null {
  const libDir = path.join(brandLibRoot(brandId), 'LOGO');
  try {
    const f = fs.readdirSync(libDir).find(x => /\.(png|svg)$/i.test(x));
    if (f) return path.join(libDir, f);
  } catch { /* */ }
  const fallback = path.join(process.cwd(), 'public', 'brand', 'logos', 'logo-green.png');
  return fs.existsSync(fallback) ? fallback : null;
}

/** Font brand (brand_fonts upload từ Team & Access): headline (Sorean) + sub (Lato). */
export function resolveFonts(brandId: string): { headline: string | null; sub: string | null } {
  const db = getDb();
  const rows = db.prepare('SELECT role, filename FROM brand_fonts WHERE brand_id=?').all(brandId) as Array<{ role: string; filename: string }>;
  const find = (role: string) => {
    const r = rows.find(x => x.role === role);
    if (!r) return null;
    const f = path.join(DATA_DIR, 'fonts', brandId, r.filename);
    return fs.existsSync(f) ? f : null;
  };
  return { headline: find('headline'), sub: find('sub') };
}

// ── Template registry (repo + custom per-brand) ────────────────────────
import { REEL_TEMPLATES, ReelTemplateDef } from './reel-template';

/** Template theo id: repo registry trước, rồi BRAND_LIBRARY/TEMPLATES/reel_<id>.json
 *  (template đúc từ brief). Không thấy → default iced_summer_v01. */
export function getReelTemplate(brandId: string, templateId?: string): ReelTemplateDef {
  const id = templateId || 'iced_summer_v01';
  if (REEL_TEMPLATES[id]) return REEL_TEMPLATES[id];
  const custom = readLibJson<ReelTemplateDef>(brandId, `TEMPLATES/reel_${id}.json`);
  if (custom?.blocks?.length) return custom;
  return REEL_TEMPLATES['iced_summer_v01'];
}

/** Danh sách template khả dụng của brand (repo + custom) — cho UI + brief matcher. */
export function listReelTemplates(brandId: string): Array<{ id: string; name: string; description: string; source: 'builtin' | 'custom' }> {
  const out: Array<{ id: string; name: string; description: string; source: 'builtin' | 'custom' }> =
    Object.values(REEL_TEMPLATES).map(t => ({ id: t.id, name: t.name, description: t.description, source: 'builtin' as const }));
  try {
    const dir = path.join(brandLibRoot(brandId), 'TEMPLATES');
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^reel_(.+)\.json$/);
      if (!m || REEL_TEMPLATES[m[1]]) continue;
      const t = readLibJson<ReelTemplateDef>(brandId, `TEMPLATES/${f}`);
      if (t?.blocks?.length) out.push({ id: t.id || m[1], name: t.name || m[1], description: t.description || '', source: 'custom' });
    }
  } catch { /* chưa có custom */ }
  return out;
}

export interface LibraryChecklist {
  ok: boolean;
  items: Array<{ key: string; label: string; ok: boolean; detail: string }>;
}

/** Checklist đỏ/xanh cho UI — thiếu gì hiện rõ, không chết âm thầm. */
export function libraryChecklist(brandId: string, skuCodes: string[], productSlugs: Record<string, string>): LibraryChecklist {
  ensureBrandLibrary(brandId);
  const items: LibraryChecklist['items'] = [];
  const fonts = resolveFonts(brandId);
  items.push({ key: 'font_headline', label: 'Font headline (Sorean)', ok: Boolean(fonts.headline), detail: fonts.headline ? path.basename(fonts.headline) : 'Upload ở Team & Access → Brand fonts' });
  items.push({ key: 'font_sub', label: 'Font phụ (Lato)', ok: Boolean(fonts.sub), detail: fonts.sub ? path.basename(fonts.sub) : 'Upload ở Team & Access → Brand fonts' });
  const logo = resolveLogo(brandId);
  items.push({ key: 'logo', label: 'Logo primary', ok: Boolean(logo), detail: logo ? path.basename(logo) : 'Nộp LOGO/*.png vào BRAND_LIBRARY' });
  for (const sku of skuCodes) {
    const p = resolvePackshot(brandId, sku, productSlugs[sku] || '');
    items.push({ key: `pack_${sku}`, label: `Packshot ${sku}`, ok: Boolean(p), detail: p ? path.basename(p) : `Nộp PACKSHOTS/${sku}/<file>.png` });
  }
  const refs = referencesRoot(brandId, 'iced_summer_v01');
  let refCount = 0;
  try { refCount = fs.readdirSync(refs).filter(f => f.endsWith('.mp4')).length; } catch { /* */ }
  items.push({ key: 'references', label: 'Video mẫu reference', ok: refCount >= 3, detail: `${refCount} clip (cần ≥3)` });
  const motion = readLibJson(brandId, 'MOTION/iced_summer_motion_dictionary.json');
  items.push({ key: 'motion_dict', label: 'Motion dictionary', ok: Boolean(motion), detail: motion ? 'đã phân tích' : 'Bấm "Phân tích video mẫu" 1 lần' });
  return { ok: items.every(i => i.ok), items };
}
