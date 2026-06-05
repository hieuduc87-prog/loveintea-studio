export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const imgDir = path.join(DATA_DIR, params.id, 'images');
    await fs.mkdir(imgDir, { recursive: true });
    const filename = `${Date.now()}_${file.name}`;
    await fs.writeFile(path.join(imgDir, filename), Buffer.from(await file.arrayBuffer()));

    const fp = path.join(DATA_DIR, params.id, 'card.json');
    const card = JSON.parse(await fs.readFile(fp, 'utf8'));
    card.images = [...(card.images || []), filename];
    card.updatedAt = new Date().toISOString();
    await fs.writeFile(fp, JSON.stringify(card, null, 2));
    return NextResponse.json(card);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
