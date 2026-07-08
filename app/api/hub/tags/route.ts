export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const db = getDb();
  const brandId = getBrandId(req);
  const tags = db.prepare(
    `SELECT t.*,
      (SELECT COUNT(*) FROM asset_tags at2 WHERE at2.tag_id = t.id) as usage_count
     FROM tags t WHERE t.brand_id = ?
     ORDER BY t.type, t.name`
  ).all(brandId);
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json() as { name: string; type?: string; color?: string; brand_id?: string };
  const brandId = getBrandId(req) || body.brand_id || '';
  const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = uuid();

  try {
    db.prepare(
      'INSERT INTO tags (id, brand_id, name, slug, type, color) VALUES (?,?,?,?,?,?)'
    ).run(id, brandId, body.name.trim(), slug, body.type || 'custom', body.color || '#6b7280');
    return NextResponse.json({ ok: true, id, slug });
  } catch {
    return NextResponse.json({ error: 'Tag name already exists' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  db.prepare('DELETE FROM asset_tags WHERE tag_id = ?').run(id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
