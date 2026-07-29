export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * POST /api/products/upload-temp — tải ảnh sản phẩm TRƯỚC khi sản phẩm tồn tại
 * (form "Thêm sản phẩm" cần ảnh bắt buộc nhưng chưa có productId để dùng
 * /api/products/[id]/images). Trả URL để gắn vào image_url lúc tạo.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getBrandId } from '@/lib/brand-guard';
import { IMAGES_DIR } from '@/lib/video/ffmpeg';

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const brandId = getBrandId(req);
  if (!brandId) return NextResponse.json({ error: 'Thiếu brand' }, { status: 400 });
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Chưa chọn file' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Chỉ nhận file ảnh' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Ảnh quá lớn (>12MB)' }, { status: 400 });

    const ext = (path.extname(file.name || '').toLowerCase().match(/^\.(png|jpe?g|webp)$/) || ['.png'])[0];
    // Tên chứa brand + random: không đoán được trên /api/images (public)
    const filename = `prod_${brandId.replace(/[^a-z0-9]/gi, '')}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buf);
    return NextResponse.json({ ok: true, url: `/api/images/${filename}` });
  } catch (e) {
    console.error('[products/upload-temp]', e);
    return NextResponse.json({ error: 'Tải ảnh thất bại' }, { status: 500 });
  }
}
