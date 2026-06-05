import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'flows');
const IMAGES_DIR = path.join(process.cwd(), 'data', 'flow-images');

function filePath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const raw = await fs.readFile(filePath(params.id), 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const raw = await fs.readFile(filePath(params.id), 'utf8');
    const existing = JSON.parse(raw);
    const body = await req.json();
    const updated = {
      ...existing,
      ...body,
      id: existing.id, // never overwrite id
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath(params.id), JSON.stringify(updated, null, 2));
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    // Remove JSON file
    await fs.unlink(filePath(params.id));

    // Remove associated images
    try {
      const entries = await fs.readdir(IMAGES_DIR);
      for (const file of entries) {
        if (file.startsWith(`${params.id}-`)) {
          await fs.unlink(path.join(IMAGES_DIR, file)).catch(() => {});
        }
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
