export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * POST /api/content-templates/[id]/generate { productId?, brandId? }
 * Sinh ảnh theo template (1 ảnh hoặc carousel N slide) → tạo 1 post draft.
 * Lõi sinh ảnh dùng chung ở lib/template-generate.ts (cũng được luồng auto-plan gọi).
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { recordTemplateUse } from '@/lib/template-picker';
import { generateTemplateImages } from '@/lib/template-generate';
import { createJob, logJob, progressJob, finishJob, failJob } from '@/lib/jobs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let jobId = '';
  try {
    const { id } = params;
    const { productId, brandId } = await req.json().catch(() => ({})) as { productId?: string; brandId?: string };
    const bid = brandId || 'loveintea';
    jobId = createJob({ brandId: bid, kind: 'carousel', source: 'Template', title: `Tạo ảnh từ template`, meta: { templateId: id, productId } });

    const { images, caption, hashtags, warnings, templateName } = await generateTemplateImages({
      templateId: id, productId, brandId: bid,
      onLog: m => logJob(jobId, m), onProgress: p => progressJob(jobId, p),
    });
    const fullCaption = caption + (hashtags ? `\n\n${hashtags}` : '');

    const postId = uuid();
    getDb().prepare(`INSERT INTO posts (id, brand_id, sku_id, platforms, content_type, caption, image_url, images_json, template_id, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?, 'draft', datetime('now'), datetime('now'))`)
      .run(postId, bid, productId ?? '', 'facebook,instagram', images.length > 1 ? 'carousel' : 'single', fullCaption, images[0], JSON.stringify(images), id);
    try { recordTemplateUse(id); } catch { /* */ }

    finishJob(jobId, { postId, count: images.length, url: images[0], warnings: warnings.length || undefined });
    return NextResponse.json({ ok: true, postId, images, caption: fullCaption, count: images.length, warnings: warnings.length ? warnings : undefined });
  } catch (e) {
    console.error('[api] template-generate', e);
    failJob(jobId, e);
    return NextResponse.json({ error: `Tạo ảnh từ template lỗi: ${String(e instanceof Error ? e.message : e).slice(0, 200)}` }, { status: 500 });
  }
}
