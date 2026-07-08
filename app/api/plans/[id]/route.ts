export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertResourceBrand } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const plan = db.prepare('SELECT * FROM content_plans WHERE id = ?').get(id) as { brand_id?: string } | undefined;
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, plan.brand_id);
  if (denied) return denied;

  const items = db.prepare(
    'SELECT * FROM plan_items WHERE plan_id = ? ORDER BY sort_order'
  ).all(id);

  const posts = db.prepare(
    'SELECT id, sku_id, status, scheduled_at, published_at, caption, platforms, plan_item_id, review_status, image_url, hashtags FROM posts WHERE plan_id = ? ORDER BY scheduled_at'
  ).all(id);

  const stats = {
    total: posts.length,
    draft: (posts as { status: string }[]).filter(p => p.status === 'draft').length,
    scheduled: (posts as { status: string }[]).filter(p => p.status === 'scheduled').length,
    published: (posts as { status: string }[]).filter(p => p.status === 'published').length,
  };

  return NextResponse.json({ plan, items, posts, stats });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const plan = db.prepare('SELECT brand_id FROM content_plans WHERE id = ?').get(id) as { brand_id?: string } | undefined;
  if (!plan) return NextResponse.json({ ok: true });
  const denied = assertResourceBrand(req, plan.brand_id);
  if (denied) return denied;

  // Delete plan items
  db.prepare('DELETE FROM plan_items WHERE plan_id = ?').run(id);
  // Unlink posts (don't delete posts, just remove plan_id)
  db.prepare('UPDATE posts SET plan_id = NULL WHERE plan_id = ?').run(id);
  // Delete plan
  db.prepare('DELETE FROM content_plans WHERE id = ?').run(id);

  return NextResponse.json({ ok: true });
}
