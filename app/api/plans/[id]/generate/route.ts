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
import { autoTagPost, PostTag } from '@/lib/post-tags';
import { createJob, finishJob, failJob } from '@/lib/jobs';

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
        let templateGuide: { structure?: string; skeleton?: string } | undefined;
        let styleHint = '';
        if (useTemplate) {
          const tpl = pickTemplate(plan.brand_id, { format: surfaceToFormat(item.surface) });
          if (tpl) {
            templateId = tpl.id;
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

        let imageUrl = '';
        if (withImage) {
          const product = item.product_id
            ? db.prepare('SELECT image_url FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(item.product_id, plan.brand_id, item.product_id) as { image_url: string } | undefined
            : undefined;
          const productPath = resolveProductImagePath(product?.image_url);
          let raw: string;
          if (productPath) raw = await editProductImage({ productImagePath: productPath, prompt: imagePrompt, size: '1024x1536' });
          else raw = await generateImage({ prompt: imagePrompt, size: '1024x1536' });
          imageUrl = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
        }

        const scheduledAt = schedule ? planItemDateToISO(item.date) : null;
        const status = schedule && scheduledAt ? 'scheduled' : 'draft';
        const postId = uuid();
        db.prepare(`INSERT INTO posts
          (id, brand_id, plan_id, plan_item_id, sku_id, caption, hashtags, image_url, image_prompt,
           platforms, status, scheduled_at, review_status, template_id)
          VALUES (?,?,?,?,?,?,?,?,?, 'facebook,instagram', ?, ?, 'pending', ?)`)
          .run(postId, plan.brand_id, planId, item.id, item.product_id ?? '',
            gen.caption, gen.hashtags, imageUrl, imagePrompt, status, scheduledAt, templateId);
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
