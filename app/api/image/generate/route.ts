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

export async function POST(req: NextRequest) {
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
    if (refImageUrl) basePath = resolveProductImagePath(refImageUrl.split('?')[0]);
    if (!basePath && productId) {
      const p = db.prepare('SELECT image_url FROM products WHERE id=? OR (brand_id=? AND slug=?)')
        .get(productId, brandId || 'loveintea', productId) as { image_url: string } | undefined;
      basePath = resolveProductImagePath(p?.image_url);
    }
    if (!basePath && templateImageUrl) basePath = resolveProductImagePath(templateImageUrl.split('?')[0]);

    logJob(jobId, basePath ? `Edit từ ảnh gốc${templateId ? ' + template' : ''}…` : 'Generate ảnh mới…');
    const raw = basePath
      ? await editProductImage({ productImagePath: basePath, prompt: finalPrompt, size: '1024x1536' })
      : await generateImage({ prompt: finalPrompt, size: '1024x1536' });
    const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
    finishJob(jobId, { url });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error('[api] image/generate', e);
    failJob(jobId, e);
    return NextResponse.json({ error: `Tạo ảnh lỗi: ${String(e instanceof Error ? e.message : e).slice(0, 200)}` }, { status: 500 });
  }
}
