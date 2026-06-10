export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { analyzeTemplateLayout } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'File must be an image or video' }, { status: 400 });
    }
    const fileType = isVideo ? 'video' : 'image';

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

    const ext = file.name.split('.').pop() ?? (isVideo ? 'mp4' : 'png');
    const id = uuid();
    const filename = `tpl-${id}.${ext}`;
    const filePath = path.join(imagesDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/api/images/${filename}`;

    let thumbnailUrl = fileUrl;
    let colorPalette = '';
    let analysis = '';

    if (isImage) {
      // Generate thumbnail
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

      // Detect dominant color
      try {
        const sharp = (await import('sharp')).default;
        const { dominant } = await sharp(filePath).stats();
        colorPalette = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
      } catch { /* skip */ }

      // Gemini Vision analysis
      try {
        const mimeType = file.type || 'image/png';
        const result = await analyzeTemplateLayout(buffer, mimeType);
        analysis = JSON.stringify(result);
      } catch (e) {
        console.error('Template analysis failed (non-blocking):', e);
      }
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO content_templates (id, brand_id, name, category, purpose, format, aspect_ratio, image_url, thumbnail_url, tags, color_palette, notes, analysis, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, brandId, name, category, purpose, format, aspectRatio, fileUrl, thumbnailUrl, tags, colorPalette, notes, analysis, fileType);

    return NextResponse.json({ ok: true, id, imageUrl: fileUrl, thumbnailUrl, analysis: analysis ? JSON.parse(analysis) : null, fileType });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
