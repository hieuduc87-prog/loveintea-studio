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
  try {
    const filePath = path.join(IMAGES_DIR, params.filename);
    const data = await fs.readFile(filePath);
    const ext = params.filename.split('.').pop()?.toLowerCase() || 'png';
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    return new NextResponse(data, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
