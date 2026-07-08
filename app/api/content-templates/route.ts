export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

// POST — create an EMPTY template shell (metadata only); images added later via /[id]/slides
export async function POST(req: NextRequest) {
  try {
    const b = await req.json() as { brandId?: string; name?: string; category?: string; format?: string; aspect_ratio?: string; purpose?: string; kind?: string; file_type?: string };
    const fileType = b.file_type === 'video' ? 'video' : 'image';
    const kind = b.kind === 'collection' ? 'collection' : 'single';
    const id = uuid();
    getDb().prepare(`INSERT INTO content_templates
      (id, brand_id, name, category, purpose, format, aspect_ratio, image_url, thumbnail_url, kind, slides_json, file_type)
      VALUES (?,?,?,?,?,?,?, '', '', ?, '[]', ?)`)
      .run(id, getBrandId(req) || b.brandId, b.name?.trim() || 'Template mới', b.category || 'general',
        b.purpose || '', b.format || (fileType === 'video' ? 'reel_cover' : 'post'), b.aspect_ratio || '2:3', kind, fileType);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const brand = getBrandId(req);
  const category = req.nextUrl.searchParams.get('category');
  const format = req.nextUrl.searchParams.get('format');
  const active = req.nextUrl.searchParams.get('active');
  const search = req.nextUrl.searchParams.get('q');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100');

  let sql = 'SELECT * FROM content_templates WHERE brand_id = ?';
  const params: (string | number)[] = [brand];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (format)   { sql += ' AND format = ?';   params.push(format); }
  if (active === '1') { sql += ' AND is_active = 1'; }
  if (active === '0') { sql += ' AND is_active = 0'; }
  if (search)   { sql += ' AND (name LIKE ? OR purpose LIKE ? OR tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  sql += ' ORDER BY usage_count DESC, created_at DESC LIMIT ?';
  params.push(limit);

  const templates = db.prepare(sql).all(...params);
  return NextResponse.json({ templates });
}
