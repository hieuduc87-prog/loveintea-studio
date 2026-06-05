import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function GET(req: Request, { params }: { params: { id: string; filename: string } }) {
  try {
    const fp = path.join(DATA_DIR, params.id, 'images', params.filename);
    const buf = await fs.readFile(fp);
    const ext = path.extname(params.filename).slice(1) || 'png';
    return new NextResponse(buf, { headers: { 'Content-Type': `image/${ext}` } });
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}
