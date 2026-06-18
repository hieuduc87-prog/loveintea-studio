/**
 * Chọn ẢNH REF phù hợp nhất của sản phẩm cho từng vai trò cảnh khi gen ảnh (gpt-image edit).
 * Tận dụng product_images đã phân loại (ref_role). Fallback hero → packshot → products.image_url.
 */
import { getDb } from './db';

// vai trò cảnh (slide role / surface) → thứ tự ưu tiên ref_role
const ROLE_PREF: Record<string, string[]> = {
  product: ['packshot', 'lifestyle'],
  hero: ['packshot', 'lifestyle'],
  cta: ['packshot', 'lifestyle'],
  ingredient: ['ingredient', 'texture', 'packshot'],
  proof: ['ingredient', 'texture', 'packshot'],
  benefit: ['lifestyle', 'packshot'],
  how_to: ['lifestyle', 'packshot'],
  hook: ['lifestyle', 'packshot'],
  lifestyle: ['lifestyle', 'packshot'],
};

interface PImg { image_url: string; ref_role: string | null; is_hero: number; angle: string | null }

// góc đẹp nhất làm base edit (chính diện rõ bao bì) → kém dần
const ANGLE_RANK: Record<string, number> = { front: 0, '45': 1, side: 2, top: 3, detail: 4, back: 5 };
const angleScore = (a: string | null) => ANGLE_RANK[(a || '').toLowerCase()] ?? 9;

/**
 * Trả image_url ảnh ref tốt nhất cho (productId, role). null nếu sản phẩm không có ảnh.
 * role: slide role hoặc surface (product/ingredient/lifestyle/hook/...).
 */
export function pickProductRefUrl(productId: string | null | undefined, role = 'product'): string | null {
  if (!productId) return null;
  const db = getDb();
  const imgs = db.prepare(
    'SELECT image_url, ref_role, is_hero, angle FROM product_images WHERE product_id=? ORDER BY is_hero DESC, sort_order ASC'
  ).all(productId) as PImg[];
  if (imgs.length) {
    const prefs = ROLE_PREF[(role || '').toLowerCase()] ?? ['packshot', 'lifestyle'];
    for (const pref of prefs) {
      const group = imgs.filter(i => (i.ref_role || '') === pref);
      if (!group.length) continue;
      // LUÔN ưu tiên góc MẶT TRƯỚC (front → 45 → side...) cho mọi vai trò — base edit chuẩn nhất.
      group.sort((a, b) => angleScore(a.angle) - angleScore(b.angle));
      return group[0].image_url;
    }
    // chưa phân loại / không khớp → ưu tiên front, rồi hero, rồi ảnh đầu
    const sorted = [...imgs].sort((a, b) => angleScore(a.angle) - angleScore(b.angle) || (b.is_hero - a.is_hero));
    return sorted[0].image_url;
  }
  // không có product_images → packshot mặc định của sản phẩm
  const p = db.prepare('SELECT image_url FROM products WHERE id=?').get(productId) as { image_url?: string } | undefined;
  return p?.image_url ?? null;
}
