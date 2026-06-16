export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export async function GET(
  req: NextRequest,
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

  // Resize-on-demand for images (?w=N, ?q=Q) — used both for fast thumbnails and
  // for publishing to FB/IG, whose photo upload rejects our ~10MB 4x masters.
  // Re-encodes as JPEG; default q85 for thumbnails, publish requests higher q for sharpness.
  const wParam = req.nextUrl.searchParams.get('w');
  const qParam = req.nextUrl.searchParams.get('q');
  const w = wParam ? Math.min(4096, Math.max(64, parseInt(wParam, 10) || 0)) : 0;
  const q = qParam ? Math.min(100, Math.max(40, parseInt(qParam, 10) || 0)) : 85;
  if (!isVideo && w) {
    try {
      const resized = sharp(buffer).resize({ width: w, withoutEnlargement: true });
      let out = await resized.jpeg({ quality: q }).toBuffer();
      // Guard: ảnh phức tạp ở quality cao có thể vượt giới hạn FB (~4MB) → hạ dần quality.
      const MAX = 3_900_000;
      for (let qq = q - 6; out.length > MAX && qq >= 60; qq -= 8) {
        out = await sharp(buffer).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: qq }).toBuffer();
      }
      return new NextResponse(new Uint8Array(out), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      /* fall through to original on resize failure */
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
    },
  });
}
