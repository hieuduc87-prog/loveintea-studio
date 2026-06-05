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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
