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
    INSERT INTO posts (id, sku_id, segment_id, rtb_id, usp_id, narrative, format, context_id, caption, image_url, image_prompt, platform, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.skuId ?? body.sku_id ?? '',
    body.segmentId ?? '',
    body.rtbId ?? '',
    body.uspId ?? '',
    body.narrativeId ?? '',
    body.format ?? '',
    body.contextId ?? '',
    body.caption ?? '',
    body.imageUrl ?? body.image_url ?? '',
    body.imagePrompt ?? body.image_prompt ?? '',
    body.platform ?? 'instagram',
    body.notes ?? '',
  );
  return NextResponse.json({ id, ok: true });
}
