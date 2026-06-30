/**
 * Sinh ảnh theo TEMPLATE (dùng chung cho route /api/content-templates/[id]/generate
 * và luồng auto theo plan). Template N slide (collection) → N ảnh theo thứ tự, giữ bố cục;
 * template 1 ảnh → 1 ảnh suy từ layout analysis. KHÔNG insert post — caller tự tạo post.
 */
import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import { editProductImage, generateImage, saveImageToFile } from './openai-image';
import { resolveProductImagePath } from './plan-generate';
import { pickProductRefUrl } from './product-ref';
import { generateJSON } from './gemini';

interface SlideAnalysis { index?: number; role?: string; content?: string; text_on_image?: string; visual?: string }
interface TplAnalysis {
  slides?: SlideAnalysis[]; structure?: string; skeleton?: string; style_keywords?: string[];
  layout?: { description?: string };
  colors?: { palette?: string[]; mood?: string };
  product_placement?: { has_product?: boolean; position?: string; size?: string; style?: string };
  content_direction?: string;
}

export interface TemplateGenResult {
  images: string[];
  caption: string;
  hashtags: string;
  warnings: string[];
  isCarousel: boolean;
  templateName: string;
}

/**
 * Sinh ảnh cho 1 template + (tùy chọn) sản phẩm. Trả images[] theo thứ tự + caption.
 * Throw nếu template không tồn tại / không có ảnh / không sinh được ảnh nào.
 */
export async function generateTemplateImages(opts: {
  templateId: string;
  productId?: string;
  brandId?: string;
  withCaption?: boolean;           // true = sinh caption bám structure (mặc định true)
  customPrompt?: string;           // yêu cầu thêm của người dùng (làm rõ scene/đạo cụ...)
  onLog?: (msg: string) => void;
  onProgress?: (pct: number) => void;
}): Promise<TemplateGenResult> {
  const { templateId, productId, customPrompt, onLog, onProgress } = opts;
  const bid = opts.brandId || 'loveintea';
  const db = getDb();

  const tpl = db.prepare('SELECT name, image_url, slides_json, analysis, tags, color_palette FROM content_templates WHERE id=?')
    .get(templateId) as { name?: string; image_url?: string; slides_json?: string; analysis?: string; tags?: string; color_palette?: string } | undefined;
  if (!tpl) throw new Error('Template không tồn tại');

  let slideUrls: Array<{ url: string }> = [];
  try { slideUrls = JSON.parse(tpl.slides_json || '[]'); } catch { /* */ }
  if (!slideUrls.length && tpl.image_url) slideUrls = [{ url: tpl.image_url }];
  if (!slideUrls.length) throw new Error('Template chưa có ảnh');

  let analysis: TplAnalysis = {};
  try { analysis = JSON.parse(tpl.analysis || '{}'); } catch { /* */ }

  // Chuẩn hoá meta TỪNG slide (1 ảnh layout-analysis | N ảnh collection)
  const N = slideUrls.length;
  const slidesMeta: SlideAnalysis[] = [];
  if (analysis.slides?.length) {
    for (let i = 0; i < N; i++) slidesMeta.push(analysis.slides[i] ?? analysis.slides[analysis.slides.length - 1] ?? {});
  } else {
    const role = analysis.product_placement?.has_product ? 'product' : 'hook';
    const content = analysis.content_direction || analysis.layout?.description || '';
    const visual = [analysis.layout?.description, analysis.colors?.mood, analysis.product_placement?.style].filter(Boolean).join('. ');
    for (let i = 0; i < N; i++) slidesMeta.push({ index: i + 1, role, content, visual });
  }

  const product = productId
    ? db.prepare('SELECT * FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(productId, bid, productId) as Record<string, string> | undefined
    : undefined;
  const packshotPath = resolveProductImagePath(product?.image_url);

  // Gợi ý kích thước thật để giữ TỈ LỆ hợp lý (card: hộp trà không được to quá so với lá trà).
  // Best-effort: bắt mẫu "11.5x7x14cm" / "11,5 x 7 x 14 cm" trong knowledge_json.
  let sizeHint = '';
  try {
    const m = (product?.knowledge_json || '').match(/\d{1,3}(?:[.,]\d)?\s*[x×*]\s*\d{1,3}(?:[.,]\d)?\s*[x×*]\s*\d{1,3}(?:[.,]\d)?\s*(?:cm|mm)?/i);
    if (m) sizeHint = m[0].replace(/\s+/g, '').replace(/[*×]/g, 'x');
  } catch { /* */ }

  let styleKw = '';
  try { styleKw = (JSON.parse(tpl.tags || '[]') as string[]).join(', '); } catch { /* */ }
  const analysisKw = (analysis.style_keywords ?? []).join(', ');
  const paletteMood = [analysis.colors?.palette?.join(', '), analysis.colors?.mood].filter(Boolean).join(' / ');
  const styleBits = [styleKw, analysisKw, tpl.color_palette, paletteMood].filter(Boolean).join('. ');

  const images: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < slideUrls.length; i++) {
    const meta = slidesMeta[i] ?? {};
    const role = (meta.role || (i === 0 ? 'hook' : 'other')).toLowerCase();
    const tplSlidePath = resolveProductImagePath((slideUrls[i].url || '').split('?')[0]);
    const refPath = resolveProductImagePath((pickProductRefUrl(productId, role) || '').split('?')[0]);

    // QUY TẮC THAY SẢN PHẨM (card: tool phải thay product Loveintea vào đúng góc template, KHÔNG giữ product mẫu):
    // - Có sản phẩm → base = ảnh REF Loveintea (giữ ĐÚNG bao bì), prompt mô tả bố cục/góc của slide template để tái dựng.
    // - Không sản phẩm → base = ảnh template slide (giữ bố cục).
    const base = productId
      ? (refPath || packshotPath || tplSlidePath)
      : (tplSlidePath || refPath || packshotPath);
    const usingProductBase = Boolean(productId && (refPath || packshotPath));

    const prompt = [
      `Vertical 2:3 social media image, slide ${i + 1} of ${slideUrls.length} in a carousel (role: ${role}).`,
      meta.content ? `Scene/composition to recreate: ${meta.content}.` : '',
      meta.visual ? `Camera angle/layout/style: ${meta.visual}.` : '',
      usingProductBase
        ? `Place the EXACT product shown in the reference image into this composition/angle. Keep its packaging shape, label, ALL printed text/wording and logos, colour AND proportions 100% identical to the reference — do NOT invent, redraw, translate, blur or omit any text on the packaging; the product's printed label must stay sharp and fully legible. The reference IS our product: ${product?.name ?? ''}.`
        : (product ? `Featured product: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}${product.ingredients ? `, ingredients: ${product.ingredients}` : ''}).` : ''),
      styleBits ? `Match the template aesthetic: ${styleBits}.` : '',
      customPrompt ? `Extra instruction: ${customPrompt}.` : '',
      // Tỉ lệ THỰC TẾ: sản phẩm không được phóng to bất thường so với đạo cụ xung quanh.
      `Keep realistic real-world proportions and believable scale between objects: the product must be sized naturally relative to surrounding props (e.g. a small tea box must NOT be oversized next to tea leaves, cups, hands or table items); no floating, no giant or shrunken product.${sizeHint ? ` Real product size ≈ ${sizeHint} — respect this physical scale.` : ''}`,
      usingProductBase
        ? 'Photorealistic, premium, on-brand. Do NOT add any extra overlay text, captions, headings, watermarks or new logos beyond what is already printed on the product packaging.'
        : 'Photorealistic, premium, on-brand. NO added text, NO letters, NO logos in the image (if any text is unavoidable, ENGLISH only — never Vietnamese).',
    ].filter(Boolean).join(' ');

    try {
      const raw = base
        ? await editProductImage({ productImagePath: base, prompt, size: '1024x1536' })
        : await generateImage({ prompt, size: '1024x1536' });
      const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
      if (url) images.push(url);
      onLog?.(`slide ${i + 1}/${slideUrls.length} ✓`);
    } catch (e) {
      const m = `slide ${i + 1}: ${String(e instanceof Error ? e.message : e).slice(0, 160)}`;
      warnings.push(m); onLog?.(`⚠ ${m}`);
    }
    onProgress?.(((i + 1) / slideUrls.length) * 90);
  }

  if (!images.length) throw new Error(`Không sinh được ảnh nào. ${warnings.join(' | ') || 'Kiểm tra OPENAI_API_KEY / quota.'}`);

  // Caption bám structure (English mặc định — brand bán US)
  let caption = ''; let hashtags = '';
  if (opts.withCaption !== false) {
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(bid) as Record<string, string> | undefined;
    const slideText = slidesMeta.map((s, i) => `${i + 1}. [${s.role}] ${s.content ?? ''}`).join('\n');
    const capPrompt = `Write a ${N > 1 ? 'CAROUSEL ' : ''}caption in English (brand sells the US market) for the brand "${bid}".
TEMPLATE STRUCTURE: ${analysis.structure || analysis.content_direction || ''}
SLIDES:\n${slideText}
${product ? `PRODUCT: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}, ingredients: ${product.ingredients ?? ''})` : 'Brand-level'}
BRAND VOICE: ${dna?.voice_traits ?? '[]'} | Tagline: ${dna?.tagline ?? ''}
COMPLIANCE: ${dna?.compliance_json ?? '{}'}
Requirements: open with a STRONG hook${N > 1 ? ' (slide 1)' : ''}, ${N > 1 ? 'mirror the slide flow, ' : ''}one clear CTA. 5-10 English hashtags.
Return ONLY JSON: {"caption":"...","hashtags":"#a #b"}`;
    try {
      const c = await generateJSON<{ caption?: string; hashtags?: string }>(capPrompt);
      caption = c.caption ?? ''; hashtags = c.hashtags ?? '';
    } catch { /* caption optional */ }
  }

  return { images, caption, hashtags, warnings, isCarousel: N > 1, templateName: tpl.name ?? templateId };
}
