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

// Slide này có hiện BAO BÌ sản phẩm không, theo VAI TRÒ (card e617a81f: carousel cần cân bằng
// nguyên liệu ↔ sản phẩm — KHÔNG nhét hộp/bao bì vào mọi slide). Chỉ vai trò hướng-sản-phẩm mới
// hiện bao bì; hook/ingredient/benefit/how_to/proof/lifestyle chỉ hiện nguyên liệu.
// Bias NGUYÊN LIỆU: role dính "ingredient" thắng (kể cả "product/ingredient") → không bao bì.
function slideShowsProduct(role: string): boolean {
  const r = (role || '').toLowerCase();
  if (/ingredient|nguyen lieu|nguyên liệu|raw|texture|hook|benefit|how[_ -]?to|lifestyle|proof/.test(r)) return false;
  return /product|san pham|sản phẩm|packshot|packaging|bao bi|bao bì|hero|cta/.test(r);
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
    // Không có phân tích từng slide → gán vai trò CÂN BẰNG (tránh nhét bao bì vào mọi slide):
    // slide đầu = hook, slide cuối = product, các slide giữa = ingredient. 1 slide: theo has_product.
    const content = analysis.content_direction || analysis.layout?.description || '';
    const visual = [analysis.layout?.description, analysis.colors?.mood, analysis.product_placement?.style].filter(Boolean).join('. ');
    for (let i = 0; i < N; i++) {
      let role: string;
      if (N === 1) role = analysis.product_placement?.has_product ? 'product' : 'hook';
      else if (i === 0) role = 'hook';
      else if (i === N - 1) role = 'product';
      else role = 'ingredient';
      slidesMeta.push({ index: i + 1, role, content, visual });
    }
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

  // Card 49186625: ý định BAO BÌ trong ghi chú người dùng thắng vai trò slide
  // ("ko kèm vỏ hộp" mà ảnh vẫn ra hộp vì role=product ép bao bì). So khớp
  // không dấu để bắt cả "khong kem vo hop" / "ko có hộp" / "no box".
  const normNote = (customPrompt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const noteNoPack = /(khong|ko)[^.;,]{0,24}(vo\s*hop|hop|bao\s*bi|box|packaging)|\b(no|without)\s+(the\s+)?(box|packaging)\b|ingredients?\s*only|chi\s+(co\s+)?nguyen\s*lieu/.test(normNote);
  const noteWithPack = !noteNoPack && /(kem|co|hien|show|with)\s+(vo\s*hop|hop|bao\s*bi|box|packaging)/.test(normNote);

  const images: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < slideUrls.length; i++) {
    const meta = slidesMeta[i] ?? {};
    const role = (meta.role || (i === 0 ? 'hook' : 'other')).toLowerCase();
    const tplSlidePath = resolveProductImagePath((slideUrls[i].url || '').split('?')[0]);
    const refPath = resolveProductImagePath((pickProductRefUrl(productId, role) || '').split('?')[0]);

    // QUY TẮC THAY SẢN PHẨM theo VAI TRÒ slide (card e617a81f):
    // - Slide vai trò SẢN PHẨM (product/cta/hero/packaging) → base = ảnh REF Loveintea, ép ĐÚNG bao bì vào bố cục slide.
    // - Slide vai trò NGUYÊN LIỆU/hook/benefit/how_to/proof → base = ảnh template slide (giữ bố cục),
    //   CHỈ hiện nguyên liệu của sản phẩm, TUYỆT ĐỐI không hộp/bao bì → carousel cân bằng nguyên liệu ↔ sản phẩm.
    const showProduct = noteNoPack ? false
      : Boolean(productId) && (noteWithPack || slideShowsProduct(role));
    const base = showProduct
      ? (refPath || packshotPath || tplSlidePath)
      : (tplSlidePath || refPath || packshotPath);
    const usingProductBase = showProduct && Boolean(refPath || packshotPath);

    const prompt = [
      `Vertical 2:3 social media image, slide ${i + 1} of ${slideUrls.length} in a carousel (role: ${role}).`,
      meta.content ? `Scene/composition to recreate: ${meta.content}.` : '',
      meta.visual ? `Camera angle/layout/style: ${meta.visual}.` : '',
      showProduct
        ? `Place the EXACT product shown in the reference image into this composition/angle. Keep its packaging shape, label, ALL printed text/wording and logos, colour AND proportions 100% identical to the reference — do NOT invent, redraw, translate, blur or omit any text on the packaging; the product's printed label must stay sharp and fully legible. The reference IS our product: ${product?.name ?? ''}.`
        : (product
            ? `This is an INGREDIENT / lifestyle slide — feature the raw or freshly prepared INGREDIENTS of "${product.name}"${product.ingredients ? ` (${product.ingredients})` : ''} arranged naturally (loose herbs, roots, flowers, dried tea, bowls, fresh produce), keeping the template slide's composition. Do NOT show the product's box, packaging, sachet, pouch, printed label or any logo in this slide — ingredients only.${product.theme ? ` Theme: ${product.theme}.` : ''}`
            : ''),
      styleBits ? `Match the template aesthetic: ${styleBits}.` : '',
      customPrompt ? `Extra instruction: ${customPrompt}.` : '',
      // Tỉ lệ THỰC TẾ: mọi vật thể/nguyên liệu tự nhiên, không phóng to bất thường.
      `Keep realistic real-world proportions and believable scale between all objects (ingredients, cups, hands, props${showProduct ? ', and the product box' : ''}); nothing oversized, floating, giant or shrunken.${sizeHint && showProduct ? ` Real product size ≈ ${sizeHint} — respect this physical scale.` : ''}`,
      showProduct
        ? 'Photorealistic, premium, on-brand. Do NOT add any extra overlay text, captions, headings, watermarks or new logos beyond what is already printed on the product packaging.'
        : 'Photorealistic, premium, on-brand. NO product packaging, NO box, NO sachet, NO added text, NO letters, NO logos in the image (if any text is unavoidable, ENGLISH only — never Vietnamese).',
    ].filter(Boolean).join(' ');

    try {
      const raw = base
        ? await editProductImage({ productImagePath: base, prompt, size: '1024x1536', brandId: opts.brandId })
        : await generateImage({ prompt, size: '1024x1536', brandId: opts.brandId });
      const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
      if (url) images.push(url);
      onLog?.(`slide ${i + 1}/${slideUrls.length} ✓`);
    } catch (e) {
      const m = `slide ${i + 1}: ${String(e instanceof Error ? e.message : e).slice(0, 260)}`;
      warnings.push(m); onLog?.(`⚠ ${m}`);
    }
    onProgress?.(((i + 1) / slideUrls.length) * 90);
  }

  if (!images.length) {
    // Nếu MỌI slide fail cùng 1 lý do (vd hết hạn mức OpenAI) → hiện 1 lần cho gọn,
    // không lặp "slide 1: ... | slide 2: ..." với cùng nội dung.
    const reasons = warnings.map(w => w.replace(/^slide \d+:\s*/, ''));
    const uniq = Array.from(new Set(reasons));
    throw new Error(uniq.length === 1 ? uniq[0] : `Không sinh được ảnh nào. ${warnings.join(' | ') || 'Kiểm tra OPENAI_API_KEY / quota.'}`);
  }

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
