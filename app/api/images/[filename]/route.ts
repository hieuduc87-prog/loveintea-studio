export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  // Sanitize — basename only (defence in depth), block traversal + dotfiles
  const safe = path.basename(filename);
  if (safe !== filename || !/^[\w][\w\-.]*$/.test(safe) || safe.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const imagesDir = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'images');
  const filePath = path.join(imagesDir, safe);
  // Resolved path must stay inside imagesDir, and must be a file (not a dir)
  if (!filePath.startsWith(imagesDir + path.sep)) {
    return new NextResponse('Not found', { status: 404 });
  }
  let buffer: Buffer;
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return new NextResponse('Not found', { status: 404 });
    buffer = fs.readFileSync(filePath);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
  const ext = path.extname(safe).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : ext === '.mp4' ? 'video/mp4'
    : ext === '.mov' ? 'video/quicktime'
    : ext === '.webm' ? 'video/webm'
    : ext === '.avi' ? 'video/x-msvideo'
    : 'image/png';

  const isVideo = contentType.startsWith('video/');

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
    },
  });
}
