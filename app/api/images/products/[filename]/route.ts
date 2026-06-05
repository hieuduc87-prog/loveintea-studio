export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!/^[\w\-.]+$/.test(filename)) return new NextResponse('Not found', { status: 404 });

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'images', 'products', filename);
  if (!fs.existsSync(filePath)) return new NextResponse('Not found', { status: 404 });

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';

  return new NextResponse(buffer, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
