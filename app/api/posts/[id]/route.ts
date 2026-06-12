export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM posts WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}

const PATCHABLE_COLUMNS = new Set([
  'caption', 'hashtags', 'image_prompt', 'image_url', 'platforms', 'status',
  'scheduled_at', 'published_at', 'fb_post_id', 'fb_scheduled_id', 'ig_post_id',
  'notes', 'review_status', 'review_notes', 'cta', 'sku_id', 'segment_id',
  'rtb_id', 'usp_id', 'narrative_id', 'context_id', 'cell_id',
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const body = await req.json();
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
