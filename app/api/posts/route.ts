export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  const db = getDb();
  const status = req.nextUrl.searchParams.get('status');
  const brand = req.nextUrl.searchParams.get('brand') || 'loveintea';
  let query = 'SELECT * FROM posts WHERE brand_id = ?';
  const params: string[] = [brand];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  const posts = db.prepare(query).all(...params);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const id = uuid();
    db.prepare(`
      INSERT INTO posts (id, brand_id, sku_id, segment_id, rtb_id, usp_id, narrative_id, context_id, cta, cell_id, caption, hashtags, image_url, image_prompt, platforms, notes, brief_id, rule_version, plan_item_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.brandId ?? body.brand_id ?? 'loveintea',
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
      body.briefId ?? body.brief_id ?? null,
      body.ruleVersion ?? body.rule_version ?? 'v1.0',
      body.planItemId ?? body.plan_item_id ?? null,
    );
    return NextResponse.json({ id, ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
