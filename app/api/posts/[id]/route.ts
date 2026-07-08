export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertResourceBrand } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id) as { brand_id?: string } | undefined;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, post.brand_id);
  if (denied) return denied;
  return NextResponse.json(post);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const row = db.prepare('SELECT brand_id FROM posts WHERE id = ?').get(params.id) as { brand_id?: string } | undefined;
  if (!row) return NextResponse.json({ ok: true });
  const denied = assertResourceBrand(req, row.brand_id);
  if (denied) return denied;
  db.prepare('DELETE FROM posts WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}

const PATCHABLE_COLUMNS = new Set([
  'caption', 'hashtags', 'image_prompt', 'image_url', 'platforms', 'status',
  'scheduled_at', 'published_at', 'fb_post_id', 'fb_scheduled_id', 'ig_post_id',
  'notes', 'review_status', 'review_notes', 'cta', 'sku_id', 'segment_id',
  'rtb_id', 'usp_id', 'narrative_id', 'context_id', 'cell_id', 'publish_mode',
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const body = await req.json();

  // Ownership + lock guards.
  const current = db.prepare('SELECT status, brand_id FROM posts WHERE id=?').get(params.id) as { status: string; brand_id?: string } | undefined;
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, current.brand_id);
  if (denied) return denied;

  // Lock: a published post cannot be rescheduled or have its status changed.
  // (review_status / notes edits are still allowed.)
  if (current.status === 'published' && (('scheduled_at' in body) || ('status' in body))) {
    return NextResponse.json({ error: 'Bài đã đăng — không thể đổi lịch hoặc trạng thái.' }, { status: 409 });
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (!PATCHABLE_COLUMNS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push("updated_at = datetime('now')");
  vals.push(params.id);
  db.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}
