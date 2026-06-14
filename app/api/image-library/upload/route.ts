export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { upscaleImage } from '@/lib/upscale';

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const skuId = (fd.get('sku_id') as string) || 'hibiscus';

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const imagesDir = path.join(dataDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    const ext = file.name.split('.').pop() ?? 'png';
    const id = uuid();
    const filename = `upload-${id}.${ext}`;
    const filePath = path.join(imagesDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Upscale if image is small (< 1500px wide)
    let imageUrl = `/api/images/${filename}`;
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(filePath).metadata();
      if ((meta.width ?? 0) < 1500) {
        const upscaledPath = await upscaleImage(filePath, 2);
        imageUrl = `/api/images/${path.basename(upscaledPath)}`;
      }
    } catch { /* skip upscale on error */ }

    // Save to image_library
    const db = getDb();
    db.prepare(`
      INSERT INTO image_library (id, sku_id, image_url, model, prompt)
      VALUES (?, ?, ?, 'upload', 'User uploaded image')
    `).run(id, skuId, imageUrl);

    return NextResponse.json({ ok: true, id, imageUrl });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
