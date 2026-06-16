export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * POST /api/content-templates/[id]/generate { productId?, brandId? }
 * Template carousel → batch ảnh. Với template N slide:
 *  - Mỗi slide: dựng image prompt từ analysis (role/content/visual) + sản phẩm đã chọn,
 *    sinh ảnh theo THỨ TỰ (base = ảnh template slide để giữ bố cục, hoặc packshot cho slide product).
 *  - Sinh caption (English mặc định) bám structure của template.
 *  - Tạo 1 post carousel (images_json = N ảnh) ở trạng thái draft.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { editProductImage, generateImage, saveImageToFile } from '@/lib/openai-image';
import { resolveProductImagePath } from '@/lib/plan-generate';
import { generateJSON } from '@/lib/gemini';
import { recordTemplateUse } from '@/lib/template-picker';

interface SlideAnalysis { index?: number; role?: string; content?: string; text_on_image?: string; visual?: string }
interface TplAnalysis {
  // collection shape
  slides?: SlideAnalysis[]; structure?: string; skeleton?: string; style_keywords?: string[];
  // single-image (layout) shape
  layout?: { description?: string };
  colors?: { palette?: string[]; mood?: string };
  product_placement?: { has_product?: boolean; position?: string; size?: string; style?: string };
  content_direction?: string;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { productId, brandId } = await req.json().catch(() => ({})) as { productId?: string; brandId?: string };
    const db = getDb();
    const bid = brandId || 'loveintea';

    const tpl = db.prepare('SELECT name, image_url, slides_json, analysis, tags, color_palette FROM content_templates WHERE id=?')
      .get(id) as { name?: string; image_url?: string; slides_json?: string; analysis?: string; tags?: string; color_palette?: string } | undefined;
    if (!tpl) return NextResponse.json({ error: 'Template không tồn tại' }, { status: 404 });

    let slideUrls: Array<{ url: string }> = [];
    try { slideUrls = JSON.parse(tpl.slides_json || '[]'); } catch { /* */ }
    if (!slideUrls.length && tpl.image_url) slideUrls = [{ url: tpl.image_url }];
    if (!slideUrls.length) return NextResponse.json({ error: 'Template chưa có ảnh' }, { status: 400 });

    let analysis: TplAnalysis = {};
    try { analysis = JSON.parse(tpl.analysis || '{}'); } catch { /* */ }

    // Chuẩn hoá meta cho TỪNG slide — đồng nhất template 1 ảnh (layout analysis)
    // và template N ảnh (collection analysis). 1 ảnh → 1 prompt; N ảnh → N prompt.
    const N = slideUrls.length;
    const slidesMeta: SlideAnalysis[] = [];
    if (analysis.slides?.length) {
      for (let i = 0; i < N; i++) slidesMeta.push(analysis.slides[i] ?? analysis.slides[analysis.slides.length - 1] ?? {});
    } else {
      // Single-image layout analysis → 1 slide meta suy từ các trường layout.
      const role = analysis.product_placement?.has_product ? 'product' : 'hook';
      const content = analysis.content_direction || analysis.layout?.description || '';
      const visual = [analysis.layout?.description, analysis.colors?.mood, analysis.product_placement?.style].filter(Boolean).join('. ');
      for (let i = 0; i < N; i++) slidesMeta.push({ index: i + 1, role, content, visual });
    }

    const product = productId
      ? db.prepare('SELECT * FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(productId, bid, productId) as Record<string, string> | undefined
      : undefined;
    const packshotPath = resolveProductImagePath(product?.image_url);

    let styleKw = '';
    try { styleKw = (JSON.parse(tpl.tags || '[]') as string[]).join(', '); } catch { /* */ }
    const analysisKw = (analysis.style_keywords ?? []).join(', ');
    const paletteMood = [analysis.colors?.palette?.join(', '), analysis.colors?.mood].filter(Boolean).join(' / ');
    const styleBits = [styleKw, analysisKw, tpl.color_palette, paletteMood].filter(Boolean).join('. ');

    // ── Sinh ảnh từng slide theo thứ tự ──
    const productRoles = new Set(['product', 'ingredient', 'proof']);
    const images: string[] = [];
    for (let i = 0; i < slideUrls.length; i++) {
      const meta = slidesMeta[i] ?? {};
      const role = (meta.role || (i === 0 ? 'hook' : 'other')).toLowerCase();
      const prompt = [
        `Vertical 2:3 social media image, slide ${i + 1} of ${slideUrls.length} in a carousel (role: ${role}).`,
        meta.content ? `Scene: ${meta.content}.` : '',
        meta.visual ? `Composition/style: ${meta.visual}.` : '',
        product ? `Featured product: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}${product.ingredients ? `, ingredients: ${product.ingredients}` : ''}).` : '',
        styleBits ? `Match the template aesthetic: ${styleBits}.` : '',
        'Photorealistic, premium, on-brand. NO text, NO letters, NO logos in the image.',
      ].filter(Boolean).join(' ');

      // Base: slide product → packshot (giữ đúng bao bì); slide khác → ảnh template (giữ bố cục).
      const tplSlidePath = resolveProductImagePath((slideUrls[i].url || '').split('?')[0]);
      const base = (productRoles.has(role) && packshotPath) ? packshotPath : (tplSlidePath || packshotPath);

      const raw = base
        ? await editProductImage({ productImagePath: base, prompt, size: '1024x1536' })
        : await generateImage({ prompt, size: '1024x1536' });
      const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
      if (url) images.push(url);
    }

    if (!images.length) return NextResponse.json({ error: 'Không sinh được ảnh nào' }, { status: 500 });

    // ── Caption bám structure template (English mặc định — brand bán US) ──
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(bid) as Record<string, string> | undefined;
    const slideText = slidesMeta.map((s, i) => `${i + 1}. [${s.role}] ${s.content ?? ''}`).join('\n');
    const capPrompt = `Write a CAROUSEL caption in English (brand sells the US market) for the brand "${bid}".
TEMPLATE STRUCTURE: ${analysis.structure || analysis.content_direction || ''}
SLIDES:\n${slideText}
${product ? `PRODUCT: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}, ingredients: ${product.ingredients ?? ''})` : 'Brand-level'}
BRAND VOICE: ${dna?.voice_traits ?? '[]'} | Tagline: ${dna?.tagline ?? ''}
COMPLIANCE: ${dna?.compliance_json ?? '{}'}
Requirements: open with a STRONG hook (slide 1), mirror the slide flow, one clear CTA. 5-10 English hashtags.
Return ONLY JSON: {"caption":"...","hashtags":"#a #b"}`;
    let caption = ''; let hashtags = '';
    try {
      const c = await generateJSON<{ caption?: string; hashtags?: string }>(capPrompt);
      caption = c.caption ?? ''; hashtags = c.hashtags ?? '';
    } catch { /* caption optional */ }
    const fullCaption = caption + (hashtags ? `\n\n${hashtags}` : '');

    // ── Tạo post carousel (draft) ──
    const postId = uuid();
    db.prepare(`INSERT INTO posts (id, brand_id, platforms, content_type, caption, image_url, images_json, template_id, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?, 'draft', datetime('now'), datetime('now'))`)
      .run(postId, bid, 'facebook,instagram', 'carousel', fullCaption, images[0], JSON.stringify(images), id);
    try { recordTemplateUse(id); } catch { /* */ }

    return NextResponse.json({ ok: true, postId, images, caption: fullCaption, count: images.length });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
