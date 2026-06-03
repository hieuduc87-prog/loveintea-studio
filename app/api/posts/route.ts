export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  const db = getDb();
  const status = req.nextUrl.searchParams.get('status');
  const posts = status
    ? db.prepare('SELECT * FROM posts WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuid();
  db.prepare(`
    INSERT INTO posts (id, sku_id, segment_id, rtb_id, usp_id, narrative_id, context_id, cta, cell_id, caption, hashtags, image_url, image_prompt, platforms, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.skuId ?? body.sku_id ?? '',
    body.segmentId ?? '',
    body.rtbId ?? '',
    body.uspId ?? '',
    body.narrativeId ?? '',
    body.contextId ?? '',
    body.cta ?? '',
    body.cellId ?? body.cell_id ?? '',
    body.caption ?? '',
    body.hashtags ?? '',
    body.imageUrl ?? body.image_url ?? '',
    body.imagePrompt ?? body.image_prompt ?? '',
    body.platforms ?? body.platform ?? 'facebook,instagram',
    body.notes ?? '',
  );
  return NextResponse.json({ id, ok: true });
}
