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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const db = getDb();
  try {
    const body = await req.json().catch(() => ({})) as { itemIds?: string[]; withImage?: boolean; schedule?: boolean };
    const withImage = Boolean(body.withImage);
    const schedule = Boolean(body.schedule);

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

    for (const item of items) {
      // Skip if a post already exists for this plan item
      const existing = db.prepare('SELECT id FROM posts WHERE plan_item_id=?').get(item.id) as { id: string } | undefined;
      if (existing) { skipped.push(item.id); continue; }

      try {
        const gen = await generateFromPlanItem(item);
        let imageUrl = '';
        if (withImage) {
          const product = item.product_id
            ? db.prepare('SELECT image_url FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(item.product_id, plan.brand_id, item.product_id) as { image_url: string } | undefined
            : undefined;
          const productPath = resolveProductImagePath(product?.image_url);
          let raw: string;
          if (productPath) raw = await editProductImage({ productImagePath: productPath, prompt: gen.image_prompt, size: '1024x1536' });
          else raw = await generateImage({ prompt: gen.image_prompt, size: '1024x1536' });
          imageUrl = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
        }

        const scheduledAt = schedule ? planItemDateToISO(item.date) : null;
        const status = schedule && scheduledAt ? 'scheduled' : 'draft';
        const postId = uuid();
        db.prepare(`INSERT INTO posts
          (id, brand_id, plan_id, plan_item_id, sku_id, caption, hashtags, image_url, image_prompt,
           platforms, status, scheduled_at, review_status)
          VALUES (?,?,?,?,?,?,?,?,?, 'facebook,instagram', ?, ?, 'pending')`)
          .run(postId, plan.brand_id, planId, item.id, item.product_id ?? '',
            gen.caption, gen.hashtags, imageUrl, gen.image_prompt, status, scheduledAt);
        created.push({ itemId: item.id, postId });
      } catch (e) {
        errors.push({ itemId: item.id, error: String(e).slice(0, 200) });
      }
    }

    return NextResponse.json({ ok: true, created, skipped, errors });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
