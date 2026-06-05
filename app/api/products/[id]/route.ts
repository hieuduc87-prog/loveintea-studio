export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const images = db.prepare(
    'SELECT * FROM product_images WHERE product_id=? ORDER BY is_hero DESC, sort_order'
  ).all(id);

  return NextResponse.json({ product, images });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json() as Record<string, unknown>;

  const allowed = ['name', 'display_name', 'theme', 'color', 'color_name', 'ingredients', 'image_url', 'best_moment', 'use_cases', 'pitch'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) {
      sets.push(`${k}=?`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
    }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  vals.push(id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  return NextResponse.json({ ok: true });
}
