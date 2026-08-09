import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { canAccessBrand } from '@/lib/brand-guard';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'flow-images');

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  try {
    // SEC (vbsec H7): kiểm chủ sở hữu flow trước khi ghi ảnh (chặn ghi chéo brand).
    const flowRaw = await fs.readFile(path.join(process.cwd(), 'data', 'flows', `${params.id}.json`), 'utf8').catch(() => null);
    if (!flowRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessBrand(req, (JSON.parse(flowRaw).brandId as string) || '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop()?.toLowerCase() || 'png').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png'; // SEC (vbsec H4): chặn ../ trong ext
    const timestamp = Date.now();
    const filename = `${params.id}-${timestamp}.${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      filename,
      url: `/api/flow-builder/${params.id}/image/${filename}`,
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
