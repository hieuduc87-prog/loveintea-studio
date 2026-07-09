import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

const SAFE_ID = /^[\w-]+$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; filename: string }> }) {
  const { id, filename } = await params;
  // Strip any path components — the URL segment must not traverse out of the dir.
  const safeName = path.basename(filename);
  if (!SAFE_ID.test(id) || safeName !== filename) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const fp = path.join(DATA_DIR, id, 'images', safeName);
    const buf = await fs.readFile(fp);
    const ext = path.extname(safeName).slice(1) || 'png';
    return new NextResponse(buf, { headers: { 'Content-Type': `image/${ext}` } });
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}
