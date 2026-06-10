export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  // Sanitize — only allow alphanumeric, hyphens, underscores, dots
  if (!/^[\w\-.]+$/.test(filename)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'images', filename);
  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : ext === '.mp4' ? 'video/mp4'
    : ext === '.mov' ? 'video/quicktime'
    : ext === '.webm' ? 'video/webm'
    : ext === '.avi' ? 'video/x-msvideo'
    : 'image/png';

  const isVideo = contentType.startsWith('video/');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
    },
  });
}
