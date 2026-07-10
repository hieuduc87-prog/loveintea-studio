export const dynamic = 'force-dynamic';
/**
 * Item nguồn học (1 video/post đối thủ để phân tích).
 * GET    /api/inspiration/items
 * POST   — multipart (file video upload) HOẶC JSON { url, caption, sourceId }
 * DELETE /api/inspiration/items?id=x
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { IMAGES_DIR } from '@/lib/video/ffmpeg';
import { isAllowedSourceUrl } from '@/lib/inspiration/download';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const items = getDb().prepare(
    `SELECT i.*, s.name AS source_name, s.platform AS source_platform
     FROM inspiration_items i LEFT JOIN inspiration_sources s ON s.id = i.source_id
     WHERE i.brand_id=? ORDER BY i.created_at DESC LIMIT 200`
  ).all(brandId);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const db = getDb();
    const id = uuid();
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
      if (!(file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name))) {
        return NextResponse.json({ error: 'Chỉ nhận file video (mp4/mov/webm)' }, { status: 400 });
      }
      const ext = path.extname(file.name).toLowerCase() || '.mp4';
      const filename = `insp_${id}${ext}`;
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(await file.arrayBuffer()));
      db.prepare(`INSERT INTO inspiration_items (id, brand_id, source_id, url, media_type, filename, caption)
        VALUES (?,?,?,?,?,?,?)`)
        .run(id, brandId, (form.get('sourceId') as string) || null, (form.get('url') as string) || null,
          'video', filename, (form.get('caption') as string) || null);
      return NextResponse.json({ ok: true, id });
    }

    const body = await req.json() as { url?: string; caption?: string; sourceId?: string };
    const url = body.url?.trim() || null;
    const caption = body.caption?.trim() || null;
    if (!url && !caption) return NextResponse.json({ error: 'Cần link video hoặc caption' }, { status: 400 });
    if (url && !isAllowedSourceUrl(url)) {
      return NextResponse.json({ error: 'Chỉ nhận link https công khai của Instagram / Facebook / TikTok / YouTube' }, { status: 400 });
    }
    // Chỉ có caption (không link) → item text: học caption/hook, không có recipe video.
    db.prepare(`INSERT INTO inspiration_items (id, brand_id, source_id, url, media_type, caption)
      VALUES (?,?,?,?,?,?)`)
      .run(id, brandId, body.sourceId || null, url, url ? 'video' : 'text', caption);
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
  const row = db.prepare('SELECT filename FROM inspiration_items WHERE id=? AND brand_id=?').get(id, brandId) as { filename: string | null } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.filename) { try { fs.unlinkSync(path.join(IMAGES_DIR, row.filename)); } catch { /* gone */ } }
  db.prepare('DELETE FROM inspiration_items WHERE id=? AND brand_id=?').run(id, brandId);
  return NextResponse.json({ ok: true });
}
