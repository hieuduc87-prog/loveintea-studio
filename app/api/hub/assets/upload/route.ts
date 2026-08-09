export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { isValidBrandSlug } from '@/lib/tenant-context';

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const fd = await req.formData();
    const files   = fd.getAll('files') as File[];
    // SEC (vbsec H4): TRƯỚC dùng fallback fd.get('brand_id') (client-controlled) rồi
    // path.join → brand_id='../../..' ghi file ra ngoài DATA_DIR. Chỉ nhận brand TIN CẬY
    // từ middleware + bắt buộc là slug hợp lệ (không / .. ký tự lạ).
    const brandId = getBrandId(req);
    if (!isValidBrandSlug(brandId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      const ext = (file.name.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'; // SEC (vbsec H4): chặn ../ trong ext
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
