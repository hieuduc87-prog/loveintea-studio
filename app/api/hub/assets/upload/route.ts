export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const fd = await req.formData();
    const files   = fd.getAll('files') as File[];
    const brandId = getBrandId(req) || (fd.get('brand_id') as string);
    const productId = (fd.get('product_id') as string) || null;

    if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });

    const dataDir  = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const assetsDir = path.join(dataDir, 'hub-assets', brandId);
    fs.mkdirSync(assetsDir, { recursive: true });

    const insert = db.prepare(`
      INSERT INTO assets
        (id, brand_id, product_id, url, filename, file_type, file_size, status, source, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?, 'unused','upload', datetime('now'), datetime('now'))
    `);

    const uploaded: { id: string; url: string }[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const id  = uuid();
      const filename = `${id}.${ext}`;
      const filePath = path.join(assetsDir, filename);
      fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

      const url = `/api/hub/assets/serve/${brandId}/${filename}`;
      insert.run(id, brandId, productId || null, url, filename,
        file.type.startsWith('image/') ? 'image' : 'file',
        file.size);
      uploaded.push({ id, url });
    }

    return NextResponse.json({ ok: true, uploaded });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
