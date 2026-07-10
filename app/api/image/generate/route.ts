export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * POST /api/image/generate { prompt, productId?, refImageUrl?, templateId? } → generate one image.
 * Base image priority: refImageUrl (ảnh tham chiếu người dùng nhập) → product packshot →
 * ảnh template — dùng edit mode để bám theo ảnh gốc. Style của template được nhồi vào prompt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { editProductImage, generateImage, saveImageToFile } from '@/lib/openai-image';
import { resolveProductImagePath } from '@/lib/plan-generate';
import { createJob, logJob, finishJob, failJob } from '@/lib/jobs';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:image', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  let jobId = '';
  try {
    const { prompt, productId, brandId, refImageUrl, templateId } = await req.json() as {
      prompt?: string; productId?: string; brandId?: string; refImageUrl?: string; templateId?: string;
    };
    if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    const db = getDb();
    jobId = createJob({ brandId, kind: 'image', source: 'CreateLab', title: `Tạo ảnh: ${prompt.slice(0, 60)}`, meta: { productId, templateId, refImageUrl } });

    // ── Fold template style into the prompt so output bám theo template đã chọn ──
    let finalPrompt = prompt;
    let templateImageUrl: string | undefined;
    if (templateId) {
      const t = db.prepare('SELECT image_url, tags, color_palette, analysis FROM content_templates WHERE id=?')
        .get(templateId) as { image_url?: string; tags?: string; color_palette?: string; analysis?: string } | undefined;
      if (t) {
        templateImageUrl = t.image_url;
        let styleTags = '';
        try { styleTags = (JSON.parse(t.tags || '[]') as string[]).join(', '); } catch { /* */ }
        // Phần lớn "DNA" template nằm trong analysis JSON (layout/style_keywords/colors),
        // KHÔNG ở cột tags/color_palette → trước đây bỏ qua khiến ảnh "không liên quan template".
        let a: { layout?: { description?: string }; style_keywords?: string[]; colors?: { palette?: string[]; mood?: string }; structure?: string; content_direction?: string } = {};
        try { a = JSON.parse(t.analysis || '{}'); } catch { /* */ }
        const styleBits = [
          styleTags,
          (a.style_keywords ?? []).join(', '),
          a.layout?.description,
          [a.colors?.palette?.join(', '), a.colors?.mood].filter(Boolean).join(' / '),
          t.color_palette,
          a.content_direction,
        ].filter(Boolean).join('. ');
        if (styleBits) finalPrompt = `${prompt}\n\nMatch this template's visual style, layout and composition closely: ${styleBits}.`;
      }
    }

    // ── Base image priority: ref người dùng nhập → product packshot → ảnh template ──
    let basePath: string | null = null;
    let editingProductBase = false;
    if (refImageUrl) { basePath = resolveProductImagePath(refImageUrl.split('?')[0]); editingProductBase = Boolean(basePath); }
    if (!basePath && productId) {
      const p = db.prepare('SELECT image_url FROM products WHERE id=? OR (brand_id=? AND slug=?)')
        .get(productId, brandId || 'loveintea', productId) as { image_url: string } | undefined;
      basePath = resolveProductImagePath(p?.image_url);
      editingProductBase = Boolean(basePath);
    }
    if (!basePath && templateImageUrl) basePath = resolveProductImagePath(templateImageUrl.split('?')[0]);

    // Tỉ lệ thực tế cho mọi ảnh (card: hộp trà không to bất thường so với lá trà).
    finalPrompt += '\n\nKeep realistic real-world proportions and believable scale between objects — the product must be sized naturally relative to surrounding props (no oversized, floating or giant product).';
    // Khi edit TỪ ảnh sản phẩm/ref: giữ NGUYÊN text in trên bao bì, chỉ cấm THÊM chữ overlay.
    // Khi tạo ảnh mới (không base sản phẩm): cấm mọi chữ (brand bán US, tránh chữ Tiếng Việt).
    finalPrompt += editingProductBase
      ? '\n\nCRITICAL: Preserve the product packaging EXACTLY as in the reference — keep all printed label text/wording, logos and colour sharp and legible; do NOT redraw, translate, blur or remove them. Do NOT add any extra overlay text/captions/watermarks beyond what is already on the packaging.'
      : '\n\nCRITICAL: Do NOT render text/letters/words in the image. If any text is unavoidable, ENGLISH only — never Vietnamese.';

    logJob(jobId, basePath ? `Edit từ ảnh gốc${templateId ? ' + template' : ''}…` : 'Generate ảnh mới…');
    const raw = basePath
      ? await editProductImage({ productImagePath: basePath, prompt: finalPrompt, size: '1024x1536', brandId })
      : await generateImage({ prompt: finalPrompt, size: '1024x1536', brandId });
    const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
    finishJob(jobId, { url });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error('[api] image/generate', e);
    failJob(jobId, e);
    return NextResponse.json({ error: `Tạo ảnh lỗi: ${String(e instanceof Error ? e.message : e).slice(0, 200)}` }, { status: 500 });
  }
}
