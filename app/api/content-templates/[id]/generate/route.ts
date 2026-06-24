export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * POST /api/content-templates/[id]/generate { productId?, brandId? }
 * Sinh ảnh theo template (1 ảnh hoặc carousel N slide) → tạo 1 post draft.
 * CHẠY NỀN + trả jobId ngay (carousel nhiều slide vượt 100s → Cloudflare 524 nếu await đồng bộ).
 * Theo dõi tiến độ/kết quả ở Job Queue. Lõi dùng chung lib/template-generate.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { recordTemplateUse } from '@/lib/template-picker';
import { generateTemplateImages } from '@/lib/template-generate';
import { createJob, logJob, progressJob, finishJob, failJob } from '@/lib/jobs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { productId, brandId, customPrompt } = await req.json().catch(() => ({})) as { productId?: string; brandId?: string; customPrompt?: string };
  const bid = brandId || 'loveintea';
  const db = getDb();
  const tpl = db.prepare('SELECT name FROM content_templates WHERE id=?').get(id) as { name?: string } | undefined;
  if (!tpl) return NextResponse.json({ error: 'Template không tồn tại' }, { status: 404 });

  const jobId = createJob({ brandId: bid, kind: 'carousel', source: 'Template', title: `Tạo ảnh từ template: ${tpl.name ?? id}`, meta: { templateId: id, productId } });

  // Background — không await để tránh Cloudflare 524. Container chạy `next start` (process sống lâu).
  void (async () => {
    try {
      const { images, caption, hashtags, warnings } = await generateTemplateImages({
        templateId: id, productId, brandId: bid, customPrompt,
        onLog: m => logJob(jobId, m), onProgress: p => progressJob(jobId, p),
      });
      const fullCaption = caption + (hashtags ? `\n\n${hashtags}` : '');
      const postId = uuid();
      getDb().prepare(`INSERT INTO posts (id, brand_id, sku_id, platforms, content_type, caption, image_url, images_json, template_id, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?, 'draft', datetime('now'), datetime('now'))`)
        .run(postId, bid, productId ?? '', 'facebook,instagram', images.length > 1 ? 'carousel' : 'single', fullCaption, images[0], JSON.stringify(images), id);
      try { recordTemplateUse(id); } catch { /* */ }
      finishJob(jobId, { postId, count: images.length, url: images[0], images, warnings: warnings.length || undefined });
    } catch (e) {
      console.error('[api] template-generate', e);
      failJob(jobId, e);
    }
  })();

  return NextResponse.json({ ok: true, jobId, async: true, message: 'Đang tạo ảnh — theo dõi ở Job Queue' });
}
