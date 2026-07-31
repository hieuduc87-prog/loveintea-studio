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

interface PImg { image_url: string; ref_role: string | null; is_hero: number; angle: string | null; ai_label?: string | null; analysis_json?: string | null }

// TRUST-CHAIN (card 7554fa71, 5 vòng verify-gate): ảnh gắn nhãn "packshot/front"
// hoá ra là packshot của TÚI TRÀ — hệ trung thành với ref nên ra túi thay vì hộp.
// TÊN ≠ NỘI DUNG: khi cần HỘP phải lọc theo NỘI DUNG ảnh (ai_label/analysis),
// không tin mỗi ref_role/angle.
const BOX_RE = /hộp|hop|box|carton|thùng|thung/i;
const BAG_RE = /túi|tui|bag|pyramid|sachet|pouch|gói|goi/i;
function looksLikeBox(i: PImg): boolean {
  const t = `${i.ai_label ?? ''} ${i.analysis_json ?? ''}`;
  return BOX_RE.test(t) && !BAG_RE.test(t.replace(BOX_RE, ''));
}

// góc đẹp nhất làm base edit (chính diện rõ bao bì) → kém dần
const ANGLE_RANK: Record<string, number> = { front: 0, '45': 1, side: 2, top: 3, detail: 4, back: 5 };
const angleScore = (a: string | null) => ANGLE_RANK[(a || '').toLowerCase()] ?? 9;

/**
 * Trả image_url ảnh ref tốt nhất cho (productId, role). null nếu sản phẩm không có ảnh.
 * role: slide role hoặc surface (product/ingredient/lifestyle/hook/...).
 */
export function pickProductRefUrl(
  productId: string | null | undefined,
  role = 'product',
  opts?: { preferBox?: boolean },
): string | null {
  if (!productId) return null;
  const db = getDb();
  // product_id của plan item có thể là SLUG ('hibiscus') ≠ products.id ('prod-hibiscus').
  // Resolve về id chuẩn để khớp product_images (nếu không, packshot trả null → AI bịa bao bì).
  const prod = db.prepare('SELECT id, image_url FROM products WHERE id=? OR slug=? LIMIT 1').get(productId, productId) as { id: string; image_url?: string } | undefined;
  const pid = prod?.id ?? productId;
  const imgs = db.prepare(
    'SELECT image_url, ref_role, is_hero, angle, ai_label, analysis_json FROM product_images WHERE product_id=? ORDER BY is_hero DESC, sort_order ASC'
  ).all(pid) as PImg[];
  if (imgs.length) {
    // LỆNH FOUNDER 31/07: ảnh HERO (nhân viên đánh dấu ⭐) là ảnh tham chiếu
    // BẮT BUỘC cho mọi hệ tạo ảnh — thắng tuyệt đối mọi heuristic role/góc.
    const hero = imgs.find(i => i.is_hero === 1);
    if (hero) return hero.image_url;
    const prefs = ROLE_PREF[(role || '').toLowerCase()] ?? ['packshot', 'lifestyle'];
    for (const pref of prefs) {
      let group = imgs.filter(i => (i.ref_role || '') === pref);
      if (!group.length) continue;
      // Cần HỘP: nội dung ảnh nói "hộp" thắng nhãn/góc (Trust-Chain, card 7554fa71).
      if (opts?.preferBox) {
        const boxes = group.filter(looksLikeBox);
        if (boxes.length) group = boxes;
        // Ref HỘP cho marketing phải là MẶT TRƯỚC: mask-lock 30/07 chọn nhầm ảnh
        // side → khoá pixel hoàn hảo... của bảng Nutrition Facts mặt sau. Hộp:
        // front > 45 > top > side/back, và nhãn nhắc nutrition/mặt sau đội sổ.
        const BOX_ANGLE: Record<string, number> = { front: 0, '45': 1, top: 2, side: 4, back: 6 };
        const backish = (i: PImg) => /nutrition|mặt sau|mat sau|back of|barcode/i.test(`${i.ai_label ?? ''} ${i.analysis_json ?? ''}`) ? 10 : 0;
        // HERO là quyền tối thượng: kho ảnh có thể trộn nhiều BIẾN THỂ (Tía Tô,
        // Chanh Dây...) đều mang nhãn "hộp trà" — nhân viên đánh dấu 1 ảnh hero
        // là chốt được ảnh chuẩn, mọi heuristic chỉ là fallback.
        group.sort((a, b) =>
          (b.is_hero - a.is_hero)
          || (((BOX_ANGLE[(a.angle || '').toLowerCase()] ?? 8) + backish(a))
            - ((BOX_ANGLE[(b.angle || '').toLowerCase()] ?? 8) + backish(b))));
        return group[0].image_url;
      }
      // LUÔN ưu tiên góc MẶT TRƯỚC (front → 45 → side...) cho mọi vai trò — base edit chuẩn nhất.
      group.sort((a, b) => angleScore(a.angle) - angleScore(b.angle));
      return group[0].image_url;
    }
    // chưa phân loại / không khớp → ưu tiên front, rồi hero, rồi ảnh đầu
    const sorted = [...imgs].sort((a, b) => angleScore(a.angle) - angleScore(b.angle) || (b.is_hero - a.is_hero));
    return sorted[0].image_url;
  }
  // không có product_images → packshot mặc định của sản phẩm
  return prod?.image_url ?? null;
}

/** Sản phẩm có ẢNH BAO BÌ/HỘP thật trong kho không — quyết định prompt có được
 *  nói tới packaging hay phải CẤM bịa hộp (gossby 30/07: AI tự vẽ hộp carton
 *  cho mũ chó không hề bán kèm hộp). */
export function productHasBoxImage(productId: string | null | undefined): boolean {
  if (!productId) return false;
  const db = getDb();
  const prod = db.prepare('SELECT id FROM products WHERE id=? OR slug=? LIMIT 1').get(productId, productId) as { id: string } | undefined;
  const rows = db.prepare('SELECT ai_label, analysis_json FROM product_images WHERE product_id=?').all(prod?.id ?? productId) as Array<{ ai_label: string | null; analysis_json: string | null }>;
  return rows.some(r => looksLikeBox({ image_url: '', ref_role: null, is_hero: 0, angle: null, ai_label: r.ai_label, analysis_json: r.analysis_json }));
}

/** Góc chụp của một ảnh ref (theo url) — để scene sinh ra KHỚP phối cảnh với
 *  pixel sản phẩm bị khoá (founder 30/07: hộp nhìn-từ-trên dán vào cảnh ngang
 *  là vênh ngay; sản phẩm không xoay được thì CẢNH phải xoay theo sản phẩm). */
export function refImageAngle(productId: string | null | undefined, imageUrl: string | null | undefined): string {
  if (!productId || !imageUrl) return '';
  const base = imageUrl.split('?')[0].split('/').pop() ?? '';
  if (!base) return '';
  const db = getDb();
  const prod = db.prepare('SELECT id FROM products WHERE id=? OR slug=? LIMIT 1').get(productId, productId) as { id: string } | undefined;
  const row = db.prepare('SELECT angle FROM product_images WHERE product_id=? AND image_url LIKE ?')
    .get(prod?.id ?? productId, `%${base}%`) as { angle: string | null } | undefined;
  return (row?.angle ?? '').toLowerCase();
}
