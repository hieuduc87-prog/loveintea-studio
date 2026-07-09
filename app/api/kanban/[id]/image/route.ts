export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { canAccessBrand } from '@/lib/brand-guard';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

// Card id is used as a directory name — reject anything that isn't a plain id
// so it can't traverse (`..`, slashes) out of DATA_DIR.
const SAFE_ID = /^[\w-]+$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SAFE_ID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  try {
    const fp = path.join(DATA_DIR, id, 'card.json');
    const card = JSON.parse(await fs.readFile(fp, 'utf8'));
    // Cards are brand-scoped — guard read/write like the card PATCH/DELETE do.
    if (!canAccessBrand(req, card.brandId || 'loveintea')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Chỉ nhận ảnh' }, { status: 400 });

    const imgDir = path.join(DATA_DIR, id, 'images');
    await fs.mkdir(imgDir, { recursive: true });
    // Never trust the client filename — strip path + unsafe chars.
    const safeName = path.basename(file.name).replace(/[^\w.-]/g, '_');
    const filename = `${Date.now()}_${safeName}`;
    await fs.writeFile(path.join(imgDir, filename), Buffer.from(await file.arrayBuffer()));

    card.images = [...(card.images || []), filename];
    card.updatedAt = new Date().toISOString();
    await fs.writeFile(fp, JSON.stringify(card, null, 2));
    return NextResponse.json(card);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
