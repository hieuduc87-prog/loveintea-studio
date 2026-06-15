import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; filename: string }> }) {
  const { id, filename } = await params;
  try {
    const fp = path.join(DATA_DIR, id, 'images', filename);
    const buf = await fs.readFile(fp);
    const ext = path.extname(filename).slice(1) || 'png';
    return new NextResponse(buf, { headers: { 'Content-Type': `image/${ext}` } });
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}
