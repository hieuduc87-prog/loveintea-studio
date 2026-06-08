export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });

    const name = (fd.get('name') as string) || file.name.replace(/\.[^.]+$/, '');
    const category = (fd.get('category') as string) || 'general';
    const purpose = (fd.get('purpose') as string) || '';
    const format = (fd.get('format') as string) || 'post';
    const aspectRatio = (fd.get('aspect_ratio') as string) || '2:3';
    const tags = (fd.get('tags') as string) || '[]';
    const notes = (fd.get('notes') as string) || '';
    const brandId = (fd.get('brand_id') as string) || 'loveintea';

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const imagesDir = path.join(dataDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    const ext = file.name.split('.').pop() ?? 'png';
    const id = uuid();
    const filename = `tpl-${id}.${ext}`;
    const filePath = path.join(imagesDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/api/images/${filename}`;

    // Generate thumbnail (resize to 400px wide)
    let thumbnailUrl = imageUrl;
    try {
      const sharp = (await import('sharp')).default;
      const thumbFilename = `tpl-${id}-thumb.webp`;
      const thumbPath = path.join(imagesDir, thumbFilename);
      await sharp(filePath)
        .resize(400, undefined, { fit: 'inside' })
        .webp({ quality: 80 })
        .toFile(thumbPath);
      thumbnailUrl = `/api/images/${thumbFilename}`;
    } catch { /* skip thumbnail on error */ }

    // Detect dominant color palette
    let colorPalette = '';
    try {
      const sharp = (await import('sharp')).default;
      const { dominant } = await sharp(filePath).stats();
      colorPalette = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
    } catch { /* skip */ }

    const db = getDb();
    db.prepare(`
      INSERT INTO content_templates (id, brand_id, name, category, purpose, format, aspect_ratio, image_url, thumbnail_url, tags, color_palette, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, brandId, name, category, purpose, format, aspectRatio, imageUrl, thumbnailUrl, tags, colorPalette, notes);

    return NextResponse.json({ ok: true, id, imageUrl, thumbnailUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
