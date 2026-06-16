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

export async function POST(req: NextRequest) {
  try {
    const { prompt, productId, brandId, refImageUrl, templateId } = await req.json() as {
      prompt?: string; productId?: string; brandId?: string; refImageUrl?: string; templateId?: string;
    };
    if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    const db = getDb();

    // ── Fold template style into the prompt so output bám theo template đã chọn ──
    let finalPrompt = prompt;
    let templateImageUrl: string | undefined;
    if (templateId) {
      const t = db.prepare('SELECT image_url, tags, color_palette FROM content_templates WHERE id=?')
        .get(templateId) as { image_url?: string; tags?: string; color_palette?: string } | undefined;
      if (t) {
        templateImageUrl = t.image_url;
        let styleTags = '';
        try { styleTags = (JSON.parse(t.tags || '[]') as string[]).join(', '); } catch { /* */ }
        const styleBits = [styleTags, t.color_palette].filter(Boolean).join('. ');
        if (styleBits) finalPrompt = `${prompt}\n\nMatch this visual style/layout: ${styleBits}.`;
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

    const raw = basePath
      ? await editProductImage({ productImagePath: basePath, prompt: finalPrompt, size: '1024x1536' })
      : await generateImage({ prompt: finalPrompt, size: '1024x1536' });
    const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
