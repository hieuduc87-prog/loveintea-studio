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

interface PImg { image_url: string; ref_role: string | null; is_hero: number }

/**
 * Trả image_url ảnh ref tốt nhất cho (productId, role). null nếu sản phẩm không có ảnh.
 * role: slide role hoặc surface (product/ingredient/lifestyle/hook/...).
 */
export function pickProductRefUrl(productId: string | null | undefined, role = 'product'): string | null {
  if (!productId) return null;
  const db = getDb();
  const imgs = db.prepare(
    'SELECT image_url, ref_role, is_hero FROM product_images WHERE product_id=? ORDER BY is_hero DESC, sort_order ASC'
  ).all(productId) as PImg[];
  if (imgs.length) {
    const prefs = ROLE_PREF[(role || '').toLowerCase()] ?? ['packshot', 'lifestyle'];
    for (const pref of prefs) {
      const hit = imgs.find(i => (i.ref_role || '') === pref);
      if (hit) return hit.image_url;
    }
    // chưa phân loại / không khớp → ảnh hero, rồi ảnh đầu
    const hero = imgs.find(i => i.is_hero === 1);
    if (hero) return hero.image_url;
    return imgs[0].image_url;
  }
  // không có product_images → packshot mặc định của sản phẩm
  const p = db.prepare('SELECT image_url FROM products WHERE id=?').get(productId) as { image_url?: string } | undefined;
  return p?.image_url ?? null;
}
