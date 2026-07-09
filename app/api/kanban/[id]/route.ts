import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { assertResourceBrand } from '@/lib/brand-guard';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fp = path.join(DATA_DIR, id, 'card.json');
  try {
    const card = JSON.parse(await fs.readFile(fp, 'utf8'));
    const denied = assertResourceBrand(req, card.brandId || 'loveintea');
    if (denied) return denied;
    const body = await req.json();
    // brandId is not client-mutable here (prevent moving a card across tenants).
    const updated = { ...card, ...body, id: card.id, brandId: card.brandId || 'loveintea', createdAt: card.createdAt, updatedAt: new Date().toISOString() };
    await fs.writeFile(fp, JSON.stringify(updated, null, 2));
    return NextResponse.json(updated);
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const card = JSON.parse(await fs.readFile(path.join(DATA_DIR, id, 'card.json'), 'utf8'));
    const denied = assertResourceBrand(req, card.brandId || 'loveintea');
    if (denied) return denied;
    await fs.rm(path.join(DATA_DIR, id), { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
}
