export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

/**
 * Kho ảnh mẫu / reference cho "Chữ lên ảnh" — mỗi layout của mỗi brand.
 * GET  ?layout=  -> list references của brand (lọc theo layout nếu có)
 * POST (multipart: file, layout, note?) -> upload ảnh mẫu, lưu vào data/images
 * DELETE ?id=    -> xoá 1 reference (chỉ trong brand mình)
 */
const LAYOUTS = ['bottom-headline', 'top-banner', 'center-quote', 'benefit-list', 'promo-badge'];

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req) || 'loveintea';
  const layout = req.nextUrl.searchParams.get('layout');
  const db = getDb();
  let sql = 'SELECT * FROM overlay_references WHERE brand_id=?';
  const params: string[] = [brandId];
  if (layout && LAYOUTS.includes(layout)) { sql += ' AND layout=?'; params.push(layout); }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  return NextResponse.json({ references: db.prepare(sql).all(...params) });
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req) || 'loveintea';
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const layout = String(fd.get('layout') || '');
    const note = String(fd.get('note') || '');
    if (!file) return NextResponse.json({ error: 'Thiếu file ảnh' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File phải là ảnh' }, { status: 400 });
    if (!LAYOUTS.includes(layout)) return NextResponse.json({ error: 'Layout không hợp lệ' }, { status: 400 });

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const imagesDir = path.join(dataDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    const ext = (file.name.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png';
    const id = uuid();
    const filename = `overlay-ref-${id}.${ext}`;
    fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(await file.arrayBuffer()));
    const imageUrl = `/api/images/${filename}`;

    getDb().prepare('INSERT INTO overlay_references (id, brand_id, layout, image_url, note) VALUES (?, ?, ?, ?, ?)')
      .run(id, brandId, layout, imageUrl, note);
    return NextResponse.json({ ok: true, reference: { id, brand_id: brandId, layout, image_url: imageUrl, note } });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[overlay-ref]', e), 'Lỗi upload ảnh mẫu') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });
  const db = getDb();
  const row = db.prepare('SELECT brand_id FROM overlay_references WHERE id=?').get(id) as { brand_id?: string } | undefined;
  if (!row) return NextResponse.json({ ok: true });
  const denied = assertResourceBrand(req, row.brand_id);
  if (denied) return denied;
  db.prepare('DELETE FROM overlay_references WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
