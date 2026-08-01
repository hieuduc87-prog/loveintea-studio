export const dynamic = 'force-dynamic';
/**
 * GET /api/posts/[id]/tags — list a post's multi-tags
 * PUT /api/posts/[id]/tags { tags:[{dimension,value,label}] } — replace MANUAL tags
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPostTags, setManualTags, PostTag } from '@/lib/post-tags';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ tags: getPostTags(params.id) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
  const { tags } = await req.json() as { tags?: PostTag[] };
  const db = getDb();
  const row = db.prepare('SELECT brand_id FROM posts WHERE id=?').get(params.id) as { brand_id: string } | undefined;
  if (row) { const denied = assertResourceBrand(req, row.brand_id); if (denied) return denied; }
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  setManualTags(params.id, row.brand_id || '', tags ?? []);
  return NextResponse.json({ ok: true, tags: getPostTags(params.id) });
}
