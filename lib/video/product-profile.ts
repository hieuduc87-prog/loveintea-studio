/**
 * Product profile — tầng KHÁI QUÁT của Reel Machine: template chỉ giữ video
 * grammar (timeline/camera/SFX), còn "sản phẩm nhìn thế nào" đúc từ DB products
 * + product knowledge của TỪNG brand (Gemini 1 lần, cache vào BRAND_LIBRARY).
 * → ném 50 sản phẩm khác brand/SKU/NGÀNH HÀNG vào là ra 50 video cùng chất lượng.
 *
 * v2 (LIT-REEL-0731): category-aware — engine trung lập ngành hàng. Profile
 * mang đủ ngữ liệu hình ảnh để template generic dựng cảnh cho BẤT KỲ sản phẩm
 * vật lý nào (đồ uống, may mặc, phụ kiện, mỹ phẩm…); các trường liquid/serve
 * chỉ có nghĩa khi isBeverage.
 */
import { getDb } from '../db';
import { generateJSON } from '../gemini';
import { readLibJson, writeLibJson } from './brand-library';
import { SKUS } from './reel-template';

export interface ProductProfile {
  productId: string;
  productName: string;
  productSlug: string;
  /** Ngành hàng (english, ngắn): 'beverage' | 'apparel' | 'pet accessory' | … */
  category?: string;
  /** Template mặc định + các luật serve/liquid chỉ bật khi true. */
  isBeverage?: boolean;
  /** Chủ thể macro hook — texture/chất liệu/chi tiết đắt nhất của sản phẩm (English, giàu texture). */
  ingredient: string;
  ingredientsAll?: string;
  /** Chi tiết điểm xuyết (beverage: garnish hợp lệ; ngành khác: prop/chi tiết phụ). */
  garnish: string;
  /** Beverage-only: mô tả màu nước tự nhiên. '' với ngành khác. */
  liquidColor: string;
  /** Hoàn cảnh sử dụng (caption). */
  moment: string;
  /** Chủ thể HERO shot — TRUNG TÍNH nóng/lạnh với beverage (template quyết). */
  heroSubject: string;
  /** Vật NEO continuity giữa các cảnh (beverage: 'tall clear glass'; khác: chính sản phẩm). */
  anchorNoun?: string;
  /** Câu canvas bối cảnh — cùng 1 thế giới cho mọi cảnh (thay SCENE_CANVAS cứng). */
  setting?: string;
  /** Câu style/chất lượng thương mại đúng ngành (thay QUALITY_BLOCK cứng). */
  styleBlock?: string;
  /** Beverage-only: sản phẩm hợp phục vụ nóng/lạnh/cả hai. */
  serveStyle?: 'hot' | 'iced' | 'both';
}

/** Profile theo productId (brand-scoped — cách ly tenant). Cache vĩnh viễn trong
 *  BRAND_LIBRARY/PROMPTS/product_profiles/; xoá file cache để buộc đúc lại.
 *  Cache thiếu `category` (schema v1) → đúc lại một lần cho đủ trường v2. */
export async function getProductProfile(brandId: string, productId: string): Promise<ProductProfile> {
  const rel = `PROMPTS/product_profiles/${productId}.json`;
  const cached = readLibJson<ProductProfile>(brandId, rel);
  if (cached?.heroSubject && cached.category) {
    if (!cached.ingredientsAll) {
      // Backfill rẻ (05/08): profile cache cũ thiếu danh sách nguyên liệu → đọc DB
      // 1 lần, KHÔNG gọi lại Gemini. QA gate cần cả list để không báo sai chủ thể.
      try {
        const row = getDb().prepare('SELECT ingredients FROM products WHERE id=? AND brand_id=?').get(productId, brandId) as { ingredients?: string } | undefined;
        let x = String(row?.ingredients || '').trim();
        if (x.charAt(0) === '[') { try { x = (JSON.parse(x) as unknown[]).map(String).filter(Boolean).join(', '); } catch { x = x.replace(/[[\]"]/g, ''); } }
        cached.ingredientsAll = x.trim() || cached.ingredient;
        writeLibJson(brandId, rel, cached);
      } catch { cached.ingredientsAll = cached.ingredient; }
    }
    return cached;
  }

  const parseIng = (raw: string | undefined): string => { let x = String(raw || '').trim(); if (x.charAt(0) === '[') { try { x = JSON.parse(x).map(String).filter(Boolean).join(', '); } catch { x = x.replace(/[\[\]"]/g, ''); } } return x.trim(); };
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
      category: 'beverage', isBeverage: true,
      ingredient: legacy.ingredient, garnish: legacy.garnish,
      liquidColor: legacy.liquidColor, moment: legacy.moment,
      heroSubject: `${legacy.liquidColor} herbal tea`,
      anchorNoun: 'tall clear glass',
      serveStyle: ({ 'nighty-night': 'hot', hibiscus: 'iced', peppermint: 'iced' } as Record<string, 'hot' | 'iced'>)[p.slug] || 'both',
    };
  } else {
    let knowledge = '';
    try { knowledge = JSON.stringify(JSON.parse(p.knowledge_json || '{}')).slice(0, 2500); } catch { /* */ }
    const r = await generateJSON<Omit<ProductProfile, 'productId' | 'productName' | 'productSlug'>>(
      `You are preparing a SENSORY VISUAL PROFILE for an AI-generated short commercial reel of the product "${p.name}". The product can be from ANY industry — first identify what it actually is, then describe how to film it.
Ingredients/components: ${String(p.ingredients || '').slice(0, 300)}
Pitch: ${String(p.pitch || '').slice(0, 200)}
Theme: ${String(p.theme || '').slice(0, 120)} | Color: ${String(p.color_name || '').slice(0, 60)} | Best moment: ${String(p.best_moment || '').slice(0, 120)}
Product knowledge: ${knowledge}
Return ONLY JSON (all values in vivid ENGLISH, photography-ready):
{"category":"short industry label, e.g. 'beverage', 'pet accessory', 'apparel', 'skincare'",
 "isBeverage":true|false,
 "ingredient":"the macro-hook subject: the most tactile material/detail/texture of THIS product (e.g. 'dried hibiscus petals, deep ruby, translucent' or 'soft embroidered cotton twill weave, saturated stitch texture')",
 "garnish":"one small accent detail/prop that truly belongs to this product's world (never misrepresent components)",
 "liquidColor":"beverage only: natural liquid color description (no neon). Empty string if not a beverage",
 "moment":"when/why people use it (one short phrase)",
 "heroSubject":"what the HERO beauty shot shows — the finished product looking its best. For beverages: what fills the vessel, NEUTRAL wording, NO hot/iced words. For other products: the product itself, worn/placed naturally",
 "anchorNoun":"the ONE physical object that must stay identical across scenes for continuity — for beverages a vessel like 'tall clear glass'; otherwise the product itself, short noun phrase",
 "setting":"ONE sentence describing the constant scene canvas: surface/environment + light, true to this product's world (e.g. 'a bright airy living room with warm wooden floor, soft morning daylight from the left')",
 "styleBlock":"ONE comma-separated style sentence for a premium commercial in this category (e.g. 'premium pet lifestyle commercial, natural bright daylight, macro detail photography, 35mm shallow depth of field, tactile realistic textures, 4K sharp clarity, stable picture, no flickering')",
 "serveStyle":"beverage only: hot|iced|both. Use 'both' if not a beverage"}
RULES: only details that truly belong to this product; never invent components; natural, premium, no garish neon look.`
    );
    const isBev = Boolean(r.isBeverage);
    profile = {
      productId: p.id, productName: p.name, productSlug: p.slug,
      category: String(r.category || (isBev ? 'beverage' : 'product')).slice(0, 60),
      isBeverage: isBev,
      ingredient: String(r.ingredient || p.name).slice(0, 200),
      garnish: String(r.garnish || 'a small natural accent detail').slice(0, 120),
      liquidColor: isBev ? String(r.liquidColor || 'natural warm amber').slice(0, 80) : '',
      moment: String(r.moment || '').slice(0, 120),
      heroSubject: String(r.heroSubject || p.name).replace(/\b(iced|hot|steaming)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 140),
      anchorNoun: String(r.anchorNoun || (isBev ? 'tall clear glass' : p.name)).slice(0, 80),
      setting: String(r.setting || 'a clean bright surface with soft natural daylight').slice(0, 220),
      styleBlock: String(r.styleBlock || 'premium product commercial, natural bright daylight, macro detail photography, 35mm shallow depth of field, tactile realistic textures, 4K sharp clarity, stable picture, no flickering').slice(0, 300),
      serveStyle: (['hot', 'iced', 'both'].includes(String((r as { serveStyle?: string }).serveStyle)) ? (r as { serveStyle?: string }).serveStyle : 'both') as 'hot' | 'iced' | 'both',
    };
  }
  profile.ingredientsAll = parseIng(p.ingredients) || profile.ingredient;
  writeLibJson(brandId, rel, profile);
  return profile;
}
