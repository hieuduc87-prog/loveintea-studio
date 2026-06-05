import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const fp = path.join(DATA_DIR, params.id, 'card.json');
  try {
    const card = JSON.parse(await fs.readFile(fp, 'utf8'));
    const body = await req.json();
    const updated = { ...card, ...body, id: card.id, createdAt: card.createdAt, updatedAt: new Date().toISOString() };
    await fs.writeFile(fp, JSON.stringify(updated, null, 2));
    return NextResponse.json(updated);
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await fs.rm(path.join(DATA_DIR, params.id), { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}
