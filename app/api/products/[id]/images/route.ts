export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const images = db.prepare(
    'SELECT * FROM product_images WHERE product_id=? ORDER BY is_hero DESC, sort_order'
  ).all(id);
  return NextResponse.json({ images });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  try {
    const db = getDb();

    // Verify product exists
    const product = db.prepare('SELECT brand_id FROM products WHERE id=?').get(productId) as { brand_id: string } | undefined;
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const fd = await req.formData();
    const files = fd.getAll('files') as File[];
    const type = (fd.get('type') as string) || 'photo';

    if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const imagesDir = path.join(dataDir, 'images', 'products');
    fs.mkdirSync(imagesDir, { recursive: true });

    const insert = db.prepare(`
      INSERT INTO product_images (id, brand_id, product_id, image_url, type, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const uploaded: { id: string; url: string }[] = [];
    const currentMax = (db.prepare(
      'SELECT MAX(sort_order) as mx FROM product_images WHERE product_id=?'
    ).get(productId) as { mx: number | null })?.mx ?? -1;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const ext = file.name.split('.').pop() ?? 'png';
      const imgId = uuid();
      const filename = `product-${productId.slice(0, 8)}-${imgId.slice(0, 8)}.${ext}`;
      const filePath = path.join(imagesDir, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const imageUrl = `/api/images/products/${filename}`;
      insert.run(imgId, product.brand_id, productId, imageUrl, type, currentMax + 1 + i);
      uploaded.push({ id: imgId, url: imageUrl });
    }

    return NextResponse.json({ ok: true, uploaded });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// PATCH — set an image's shot type (for shot-list coverage) or hero flag.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const db = getDb();
  const { imageId, type, isHero } = await req.json() as { imageId?: string; type?: string; isHero?: boolean };
  if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });
  if (type) db.prepare('UPDATE product_images SET type=? WHERE id=? AND product_id=?').run(type, imageId, productId);
  if (isHero !== undefined) {
    if (isHero) db.prepare('UPDATE product_images SET is_hero=0 WHERE product_id=?').run(productId);
    db.prepare('UPDATE product_images SET is_hero=? WHERE id=? AND product_id=?').run(isHero ? 1 : 0, imageId, productId);
  }
  return NextResponse.json({ ok: true });
}

// DELETE — remove an image (?imageId=)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const db = getDb();
  const imageId = req.nextUrl.searchParams.get('imageId');
  if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });
  const row = db.prepare('SELECT image_url FROM product_images WHERE id=? AND product_id=?').get(imageId, productId) as { image_url: string } | undefined;
  if (row?.image_url?.startsWith('/api/images/')) {
    try { fs.unlinkSync(path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'images', row.image_url.replace('/api/images/', ''))); } catch { /* gone */ }
  }
  db.prepare('DELETE FROM product_images WHERE id=? AND product_id=?').run(imageId, productId);
  return NextResponse.json({ ok: true });
}
