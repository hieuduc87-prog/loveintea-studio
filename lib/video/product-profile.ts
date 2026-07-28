/**
 * Product profile — tầng KHÁI QUÁT của Reel Machine: template chỉ giữ video
 * grammar (timeline/camera/SFX), còn "sản phẩm nhìn thế nào" đúc từ DB products
 * + product knowledge của TỪNG brand (Gemini 1 lần, cache vào BRAND_LIBRARY).
 * → ném 50 sản phẩm khác brand/SKU vào là ra 50 video cùng chất lượng.
 */
import { getDb } from '../db';
import { generateJSON } from '../gemini';
import { readLibJson, writeLibJson } from './brand-library';
import { SKUS } from './reel-template';

export interface ProductProfile {
  productId: string;
  productName: string;
  productSlug: string;
  /** Chủ thể macro/ingredient-action (English, giàu texture). */
  ingredient: string;
  /** Garnish hợp lệ (không claim thành phần sai). */
  garnish: string;
  /** Mô tả màu nước tự nhiên. */
  liquidColor: string;
  /** Hoàn cảnh sử dụng (caption). */
  moment: string;
  /** Chủ thể ly hero, vd "iced ruby-red hibiscus herbal tea". */
  heroSubject: string;
}

/** Profile theo productId (brand-scoped — cách ly tenant). Cache vĩnh viễn trong
 *  BRAND_LIBRARY/PROMPTS/product_profiles/; xoá file cache để buộc đúc lại. */
export async function getProductProfile(brandId: string, productId: string): Promise<ProductProfile> {
  const rel = `PROMPTS/product_profiles/${productId}.json`;
  const cached = readLibJson<ProductProfile>(brandId, rel);
  if (cached?.heroSubject) return cached;

  const db = getDb();
  const p = db.prepare(
    'SELECT id, name, slug, ingredients, pitch, theme, best_moment, color_name, knowledge_json FROM products WHERE id=? AND brand_id=?'
  ).get(productId, brandId) as {
    id: string; name: string; slug: string; ingredients?: string; pitch?: string;
    theme?: string; best_moment?: string; color_name?: string; knowledge_json?: string;
  } | undefined;
  if (!p) throw new Error(`Sản phẩm ${productId} không thuộc brand ${brandId}`);

  // Legacy nhanh: bảng SKU LoveinTea đã tinh chỉnh tay — dùng nếu khớp slug
  const legacy = Object.values(SKUS).find(s => s.productSlug === p.slug);
  let profile: ProductProfile;
  if (legacy) {
    profile = {
      productId: p.id, productName: p.name, productSlug: p.slug,
      ingredient: legacy.ingredient, garnish: legacy.garnish,
      liquidColor: legacy.liquidColor, moment: legacy.moment,
      heroSubject: `${legacy.liquidColor} herbal tea`,
    };
  } else {
    let knowledge = '';
    try { knowledge = JSON.stringify(JSON.parse(p.knowledge_json || '{}')).slice(0, 2500); } catch { /* */ }
    const r = await generateJSON<Omit<ProductProfile, 'productId' | 'productName' | 'productSlug'>>(
      `You are preparing a SENSORY VISUAL PROFILE for an AI-generated beverage reel of the product "${p.name}".
Ingredients: ${String(p.ingredients || '').slice(0, 300)}
Pitch: ${String(p.pitch || '').slice(0, 200)}
Theme: ${String(p.theme || '').slice(0, 120)} | Color: ${String(p.color_name || '').slice(0, 60)} | Best moment: ${String(p.best_moment || '').slice(0, 120)}
Product knowledge: ${knowledge}
Return ONLY JSON (all values in vivid ENGLISH, photography-ready):
{"ingredient":"the real hero ingredient(s) with texture words (e.g. 'dried hibiscus petals, deep ruby, translucent')",
 "garnish":"one safe garnish that does NOT misrepresent ingredients",
 "liquidColor":"natural liquid color description (no neon)",
 "moment":"when/why people drink it (one short phrase)",
 "heroSubject":"what fills the hero glass, e.g. 'iced golden ginger herbal tea'"}
RULES: only ingredients that truly belong to this product; never invent fruits/berries not in it; natural, premium, no soda/cocktail vibes.`
    );
    profile = {
      productId: p.id, productName: p.name, productSlug: p.slug,
      ingredient: String(r.ingredient || p.name).slice(0, 200),
      garnish: String(r.garnish || 'a small fresh herb sprig').slice(0, 120),
      liquidColor: String(r.liquidColor || 'natural warm amber').slice(0, 80),
      moment: String(r.moment || '').slice(0, 120),
      heroSubject: String(r.heroSubject || `iced ${p.name} beverage`).slice(0, 120),
    };
  }
  writeLibJson(brandId, rel, profile);
  return profile;
}
