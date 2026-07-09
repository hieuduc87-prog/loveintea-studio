import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'flow-images');

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string; filename: string } }
) {
  // Strip any path components — the URL segment must not traverse out of the dir.
  const safeName = path.basename(params.filename);
  if (safeName !== params.filename) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const filePath = path.join(IMAGES_DIR, safeName);
    const data = await fs.readFile(filePath);
    const ext = safeName.split('.').pop()?.toLowerCase() || 'png';
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    return new NextResponse(data, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
