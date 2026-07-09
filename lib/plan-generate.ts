/**
 * Generate post content directly from a plan_item (hook, copy/visual direction)
 * grounded in brand DNA + compliance + active rules. Lighter than the full O3
 * engine (which needs all 6 variable IDs) — plan items rarely carry all of them.
 */
import fs from 'fs';
import path from 'path';
import { getDb } from './db';
import { generateJSON } from './gemini';
import { getExpertKnowledgeBlock } from './brand-knowledge';
import { resolveLangName } from './brand-lang';

export interface PlanItemRow {
  id: string; plan_id: string; brand_id: string; date: string; day_of_week: string;
  wave: string; surface: string; purpose: string; pillar: string;
  product_id: string | null; audience_code: string; rtb_code: string; usp_code: string;
  context: string; hook: string; copy_direction: string; visual_direction: string;
  hashtags: string;
}

export interface GeneratedContent {
  caption: string; hashtags: string; image_prompt: string;
  // Targeting the AI declares (grounded in brand strategy) — used for multi-tagging
  targeting?: { segment?: string; insight?: string; behavior?: string };
}

const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** "Jun 8" (+ reference year) → ISO at 09:00 local. Returns null if unparseable. */
export function planItemDateToISO(dateStr: string, refYear = new Date().getFullYear()): string | null {
  const m = (dateStr || '').trim().match(/^(\w{3})\s+(\d{1,2})$/);
  if (!m) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const month = MONTH_IDX[m[1]];
  const day = parseInt(m[2], 10);
  if (month === undefined || isNaN(day)) return null;
  return new Date(refYear, month, day, 9, 0, 0).toISOString();
}

/** Resolve a product image_url to a readable local file path (for edit-mode image gen). */
export function resolveProductImagePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  let p: string | null = null;
  if (imageUrl.startsWith('/api/images/')) p = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'images', imageUrl.replace('/api/images/', ''));
  else if (imageUrl.startsWith('/')) p = path.join(process.cwd(), 'public', imageUrl);
  return p && fs.existsSync(p) ? p : null;
}

export async function generateFromPlanItem(item: PlanItemRow, templateGuide?: { structure?: string; skeleton?: string }): Promise<GeneratedContent> {
  const db = getDb();
  const brandId = item.brand_id || 'loveintea';
  const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
  const product = item.product_id
    ? db.prepare('SELECT * FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(item.product_id, brandId, item.product_id) as Record<string, string> | undefined
    : undefined;
  const rules = (db.prepare(`SELECT rule_text FROM content_rules WHERE brand_id=? AND status='active' ORDER BY created_at DESC LIMIT 20`).all(brandId) as Array<{ rule_text: string }>).map(r => r.rule_text);

  // Ngôn ngữ caption/hashtags theo brand (content_language). Image_prompt luôn English.
  const langName = resolveLangName(dna?.content_language, brandId);
  const prompt = `You write social media posts for the brand "${brandId}". Produce ONE post from this plan item.

PLAN ITEM:
- Surface/format: ${item.surface || 'feed post'}
- Purpose: ${item.purpose || ''} | Pillar: ${item.pillar || ''} | Wave: ${item.wave || ''}
- Product: ${product ? `${product.name} — ${product.pitch ?? ''} (theme: ${product.theme ?? ''}, ingredients: ${product.ingredients ?? ''})` : 'brand-level (no specific product)'}
- Hook idea: ${item.hook || '(none — create one)'}
- Copy direction: ${item.copy_direction || ''}
- Visual direction: ${item.visual_direction || ''}
- Context: ${item.context || ''}
${templateGuide?.skeleton ? `\nTEMPLATE STRUCTURE TO FOLLOW (dựng post theo khung sườn này nhưng cho ĐÚNG sản phẩm trên):\n- Cấu trúc: ${templateGuide.structure ?? ''}\n- Khung sườn: ${templateGuide.skeleton}` : ''}

BRAND DNA:
- Tagline: ${dna?.tagline ?? ''} | Archetype: ${dna?.archetype ?? ''}
- Voice: ${dna?.voice_traits ?? '[]'}
- Khách hàng mục tiêu: ${dna?.target_audience ?? ''}
- Insight: ${dna?.insight ?? ''}
- Hành vi: ${dna?.behavior ?? ''}
- COMPLIANCE (obey strictly): ${dna?.compliance_json ?? '{}'}
${dna?.brand_rules ? `- RULE RIÊNG BRAND (bắt buộc): ${dna.brand_rules}` : ''}
${rules.length ? `ACTIVE RULES:\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : ''}
${getExpertKnowledgeBlock(brandId)}

REQUIREMENTS:
1. caption: write in ${langName} (do NOT mix languages), on-brand voice, benefit-led. Open with a STRONG scroll-stopping hook, then follow the copy direction, obey compliance neverSay/alwaysSay. Natural length for the surface (Reel cover = short; feed = 2-4 short paragraphs). Include 1 clear CTA.
2. hashtags: 5-10 relevant ${langName} hashtags, space-separated, each starting with #.
3. image_prompt: a 50-90 word English prompt for an image generator matching the visual direction — describe the product scene, lighting, mood, composition (vertical). NO text/letters in the image.
4. targeting: which audience SEGMENT this post speaks to, the INSIGHT it leverages, and the BEHAVIOR it targets — short Vietnamese phrases drawn from the brand's strategy${dna?.target_audience ? `\n   (Khách hàng: ${dna.target_audience})` : ''}${dna?.insight ? `\n   (Insight brand: ${dna.insight})` : ''}${dna?.behavior ? `\n   (Hành vi: ${dna.behavior})` : ''}.

Return ONLY JSON: {"caption":"...","hashtags":"#a #b","image_prompt":"...","targeting":{"segment":"...","insight":"...","behavior":"..."}}`;

  const out = await generateJSON<GeneratedContent>(prompt);
  return {
    caption: out.caption ?? '',
    hashtags: out.hashtags ?? '',
    image_prompt: out.image_prompt ?? '',
    targeting: out.targeting ?? {},
  };
}
