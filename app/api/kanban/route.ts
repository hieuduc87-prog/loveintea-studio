import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');
async function ensureDir() { await fs.mkdir(DATA_DIR, { recursive: true }); }

export async function GET() {
  await ensureDir();
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const cards = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try { cards.push(JSON.parse(await fs.readFile(path.join(DATA_DIR, e.name, 'card.json'), 'utf8'))); } catch {}
    }
    cards.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(cards);
  } catch { return NextResponse.json([]); }
}

export async function POST(req: Request) {
  await ensureDir();
  const body = await req.json();
  const id = crypto.randomUUID();
  const card = {
    id, title: body.title || 'Untitled',
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
