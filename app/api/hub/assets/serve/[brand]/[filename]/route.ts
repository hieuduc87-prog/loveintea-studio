export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { canAccessBrand } from '@/lib/brand-guard';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string; filename: string }> }
) {
  const { brand, filename } = await params;
  if (brand.includes('..') || filename.includes('..') || path.basename(filename) !== filename) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  if (!canAccessBrand(req, brand)) return new NextResponse('Forbidden', { status: 403 });
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'hub-assets', brand, filename);

  if (!fs.existsSync(filePath)) return new NextResponse('Not found', { status: 404 });

  const buf = fs.readFileSync(filePath);
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  return new NextResponse(buf, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
