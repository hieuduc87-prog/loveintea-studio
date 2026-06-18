export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * POST /api/plans/[id]/generate — turn plan items into posts.
 * body: { itemIds?: string[]  // omit = all items without a post yet
 *         withImage?: boolean  // also generate the image (slower)
 *         schedule?: boolean } // set scheduled_at from the plan item date + status=scheduled
 *
 * Idempotent: skips plan items that already have a linked post.
 * Process the itemIds the client sends (it loops for progress on "Run all").
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { generateFromPlanItem, planItemDateToISO, resolveProductImagePath, PlanItemRow } from '@/lib/plan-generate';
import { editProductImage, generateImage, saveImageToFile } from '@/lib/openai-image';
import { pickTemplate, recordTemplateUse } from '@/lib/template-picker';
import { generateTemplateImages } from '@/lib/template-generate';
import { pickProductRefUrl } from '@/lib/product-ref';
import { autoTagPost, PostTag } from '@/lib/post-tags';
import { createJob, logJob, finishJob, failJob } from '@/lib/jobs';

function surfaceToFormat(surface: string): string | undefined {
  const s = (surface || '').toLowerCase();
  if (s.includes('reel')) return 'reel_cover';
  if (s.includes('carousel')) return 'carousel';
  if (s.includes('story')) return 'story';
  if (s.includes('still') || s.includes('post') || s.includes('feed')) return 'post';
  return undefined;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const db = getDb();
  let jobId = '';
  try {
    const body = await req.json().catch(() => ({})) as { itemIds?: string[]; withImage?: boolean; schedule?: boolean; useTemplate?: boolean };
    const withImage = Boolean(body.withImage);
    const schedule = Boolean(body.schedule);
    const useTemplate = Boolean(body.useTemplate);

    const plan = db.prepare('SELECT brand_id FROM content_plans WHERE id=?').get(planId) as { brand_id: string } | undefined;
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    let items: PlanItemRow[];
    if (body.itemIds?.length) {
      const ph = body.itemIds.map(() => '?').join(',');
      items = db.prepare(`SELECT * FROM plan_items WHERE plan_id=? AND id IN (${ph})`).all(planId, ...body.itemIds) as PlanItemRow[];
    } else {
      items = db.prepare('SELECT * FROM plan_items WHERE plan_id=? ORDER BY sort_order').all(planId) as PlanItemRow[];
    }

    const created: Array<{ itemId: string; postId: string }> = [];
    const skipped: string[] = [];
    const errors: Array<{ itemId: string; error: string }> = [];
    jobId = createJob({ brandId: plan.brand_id, kind: 'plan', source: 'PlanCalendar', title: `Tạo bài từ plan (${items.length} item${withImage ? ' + ảnh' : ''})`, meta: { withImage, schedule, useTemplate } });

    for (const item of items) {
      // Skip if a post already exists for this plan item
      const existing = db.prepare('SELECT id FROM posts WHERE plan_item_id=?').get(item.id) as { id: string } | undefined;
      if (existing) { skipped.push(item.id); continue; }

      try {
        // Template operating flow: pick a template (rotation + win-bias) for this surface,
        // read its analysed structure/skeleton so the post mirrors the template for THIS product.
        let templateId: string | null = null;
        let templateKind = '';
        let templateGuide: { structure?: string; skeleton?: string } | undefined;
        let styleHint = '';
        if (useTemplate) {
          const tpl = pickTemplate(plan.brand_id, { format: surfaceToFormat(item.surface) });
          if (tpl) {
            templateId = tpl.id;
            templateKind = tpl.kind;
            try {
              const a = JSON.parse(tpl.analysis || '{}') as { style_keywords?: string[]; layout?: { description?: string }; structure?: string; skeleton?: string };
              styleHint = [a.style_keywords?.join(', '), a.layout?.description].filter(Boolean).join('. ');
              if (a.skeleton || a.structure) templateGuide = { structure: a.structure, skeleton: a.skeleton };
            } catch { /* */ }
          }
        }

        const gen = await generateFromPlanItem(item, templateGuide);
        let imagePrompt = gen.image_prompt;
        if (styleHint) imagePrompt = `${gen.image_prompt}\n\nFollow this template style/layout: ${styleHint}`;
        // Brand bán US: ảnh KHÔNG được có chữ Tiếng Việt. Ưu tiên không chữ; nếu có thì English.
        imagePrompt += '\n\nCRITICAL: Do NOT render any text, letters, or words in the image. If any text is truly unavoidable, it MUST be in ENGLISH only — NEVER Vietnamese.';

        let imageUrl = '';
        let imagesJson: string | null = null;
        let contentType = 'single';
        if (withImage) {
          if (templateId && templateKind === 'collection') {
            // Template carousel → sinh ĐỦ N ảnh theo template (giữ caption theo plan item).
            logJob(jobId, `item ${item.id.slice(0, 6)}: carousel template…`);
            const tg = await generateTemplateImages({
              templateId, productId: item.product_id ?? undefined, brandId: plan.brand_id,
              withCaption: false, onLog: m => logJob(jobId, `  ${m}`),
            });
            if (tg.images.length) {
              imageUrl = tg.images[0];
              imagesJson = JSON.stringify(tg.images);
              contentType = tg.images.length > 1 ? 'carousel' : 'single';
            }
          } else {
            // 1 ảnh: ưu tiên ảnh ref sản phẩm đã phân loại (packshot) → ảnh template → generate.
            let basePath = resolveProductImagePath((pickProductRefUrl(item.product_id, 'product') || '').split('?')[0]);
            if (!basePath && templateId) {
              const ti = db.prepare('SELECT image_url FROM content_templates WHERE id=?').get(templateId) as { image_url?: string } | undefined;
              basePath = resolveProductImagePath((ti?.image_url || '').split('?')[0]);
            }
            const raw = basePath
              ? await editProductImage({ productImagePath: basePath, prompt: imagePrompt, size: '1024x1536' })
              : await generateImage({ prompt: imagePrompt, size: '1024x1536' });
            imageUrl = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
          }
        }

        const scheduledAt = schedule ? planItemDateToISO(item.date) : null;
        const status = schedule && scheduledAt ? 'scheduled' : 'draft';
        const postId = uuid();
        db.prepare(`INSERT INTO posts
          (id, brand_id, plan_id, plan_item_id, sku_id, caption, hashtags, image_url, images_json, content_type, image_prompt,
           platforms, status, scheduled_at, review_status, template_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, 'facebook,instagram', ?, ?, 'pending', ?)`)
          .run(postId, plan.brand_id, planId, item.id, item.product_id ?? '',
            gen.caption, gen.hashtags, imageUrl, imagesJson, contentType, imagePrompt, status, scheduledAt, templateId);
        if (templateId) recordTemplateUse(templateId);

        // Multi-tag the post from the start (product/template via structured cols + AI targeting + plan dims)
        const extra: PostTag[] = [];
        if (item.product_id) extra.push({ dimension: 'product', value: item.product_id, source: 'auto' });
        if (templateId) extra.push({ dimension: 'template', value: templateId, source: 'auto' });
        if (item.audience_code) extra.push({ dimension: 'segment', value: item.audience_code, source: 'auto' });
        if (item.usp_code) extra.push({ dimension: 'usp', value: item.usp_code, source: 'auto' });
        if (item.rtb_code) extra.push({ dimension: 'rtb', value: item.rtb_code, source: 'auto' });
        if (item.pillar) extra.push({ dimension: 'pillar', value: item.pillar, source: 'auto' });
        if (item.purpose) extra.push({ dimension: 'purpose', value: item.purpose, source: 'auto' });
        const fmt = surfaceToFormat(item.surface); if (fmt) extra.push({ dimension: 'format', value: fmt, source: 'auto' });
        const t = gen.targeting ?? {};
        if (t.segment)  extra.push({ dimension: 'segment',  value: t.segment,  source: 'auto' });
        if (t.insight)  extra.push({ dimension: 'insight',  value: t.insight,  source: 'auto' });
        if (t.behavior) extra.push({ dimension: 'behavior', value: t.behavior, source: 'auto' });
        autoTagPost(postId, extra);

        created.push({ itemId: item.id, postId });
      } catch (e) {
        errors.push({ itemId: item.id, error: (console.error('[api]', e), 'Có lỗi hệ thống').slice(0, 200) });
      }
    }

    if (errors.length && !created.length) failJob(jobId, errors.map(e => e.error).join(' | '));
    else finishJob(jobId, { created: created.length, skipped: skipped.length, errors: errors.length });
    return NextResponse.json({ ok: true, created, skipped, errors });
  } catch (e) {
    failJob(jobId, e);
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
