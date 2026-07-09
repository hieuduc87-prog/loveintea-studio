import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getBrandId, isAllBrands } from '@/lib/brand-guard';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');
async function ensureDir() { await fs.mkdir(DATA_DIR, { recursive: true }); }

export async function GET(req: NextRequest) {
  await ensureDir();
  try {
    // Trusted brand from middleware. Admin may request '__all__' for the aggregate
    // board (every brand's cards, each tagged). Legacy cards without brandId = loveintea.
    const brand = getBrandId(req) || 'loveintea';
    const aggregate = brand === '__all__' && isAllBrands(req);
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const cards = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const c = JSON.parse(await fs.readFile(path.join(DATA_DIR, e.name, 'card.json'), 'utf8'));
        const cBrand = c.brandId || 'loveintea';
        if (aggregate || cBrand === brand) cards.push({ ...c, brandId: cBrand });
      } catch {}
    }
    cards.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(cards);
  } catch { return NextResponse.json([]); }
}

export async function POST(req: NextRequest) {
  await ensureDir();
  const body = await req.json();
  // Cards are always created under a concrete brand (never the '__all__' view).
  let brand = getBrandId(req) || 'loveintea';
  if (brand === '__all__') brand = 'loveintea';
  const id = crypto.randomUUID();
  const card = {
    id, brandId: brand, title: body.title || 'Untitled',
    description: body.description || '',
    goal: body.goal || '',
    type: body.type || 'task',
    priority: body.priority || 'medium',
    status: body.status || 'todo',
    fileHint: body.fileHint || '',
    errorLog: body.errorLog || '',
    fixResult: null,
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.join(DATA_DIR, id), { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, id, 'card.json'), JSON.stringify(card, null, 2));
  return NextResponse.json(card);
}
