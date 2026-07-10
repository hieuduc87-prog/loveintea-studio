export const dynamic = 'force-dynamic';
/**
 * Nguồn học — danh sách page/IG/TikTok đối thủ để theo dõi & học template.
 * GET    /api/inspiration/sources
 * POST   /api/inspiration/sources { platform, name, url, notes }
 * DELETE /api/inspiration/sources?id=x
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const sources = getDb().prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM inspiration_items i WHERE i.source_id = s.id) AS item_count
     FROM inspiration_sources s WHERE s.brand_id=? ORDER BY s.created_at DESC`
  ).all(brandId);
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const body = await req.json() as { platform?: string; name?: string; url?: string; notes?: string };
    if (!body.name?.trim() && !body.url?.trim()) {
      return NextResponse.json({ error: 'Cần tên hoặc URL nguồn' }, { status: 400 });
    }
    const id = uuid();
    const platform = ['instagram', 'facebook', 'tiktok', 'youtube', 'other'].includes(body.platform || '') ? body.platform : 'instagram';
    getDb().prepare(`INSERT INTO inspiration_sources (id, brand_id, platform, name, url, notes) VALUES (?,?,?,?,?,?)`)
      .run(id, brandId, platform, body.name?.trim() ?? '', body.url?.trim() ?? '', body.notes?.trim() ?? '');
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const brandId = getBrandId(req);
  const db = getDb();
  const row = db.prepare('SELECT id FROM inspiration_sources WHERE id=? AND brand_id=?').get(id, brandId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Giữ items (chỉ mất liên kết nguồn) — bài học đã phân tích vẫn còn giá trị.
  db.prepare('UPDATE inspiration_items SET source_id=NULL WHERE source_id=? AND brand_id=?').run(id, brandId);
  db.prepare('DELETE FROM inspiration_sources WHERE id=? AND brand_id=?').run(id, brandId);
  return NextResponse.json({ ok: true });
}
