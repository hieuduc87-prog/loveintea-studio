export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const products = db.prepare('SELECT * FROM products WHERE brand_id = ? ORDER BY sort_order').all(id);
  const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id = ?').get(id);
  return NextResponse.json({ brand, products, dna });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json() as Record<string, unknown>;
  const allowed = ['name', 'slug', 'logo_url', 'domain'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  vals.push(id);
  db.prepare(`UPDATE brands SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === 'loveintea') return NextResponse.json({ error: 'Cannot delete default brand' }, { status: 400 });
  const db = getDb();
  db.prepare('DELETE FROM brands WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
