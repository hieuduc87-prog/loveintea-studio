export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { canAccessBrand } from '@/lib/brand-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = await params;
  // Existence check alone let any tenant inject products into another brand.
  if (!canAccessBrand(req, brandId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getDb();

  const brand = db.prepare('SELECT 1 FROM brands WHERE id = ?').get(brandId);
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  const body = await req.json() as {
    name: string; slug?: string; display_name?: string; theme?: string;
    color?: string; color_name?: string; pitch?: string; image_url?: string;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const slug = body.slug?.trim() ||
    body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = uuid();

  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as mx FROM products WHERE brand_id = ?'
  ).get(brandId) as { mx: number | null })?.mx ?? -1;

  try {
    db.prepare(`
      INSERT INTO products
        (id, brand_id, slug, name, display_name, theme, color, color_name, pitch, image_url, sort_order, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).run(
      id, brandId, slug, body.name.trim(),
      body.display_name || body.name.trim(),
      body.theme || '', body.color || '#888888',
      body.color_name || '', body.pitch || '',
      body.image_url || '', maxOrder + 1
    );
    return NextResponse.json({ ok: true, id, slug });
  } catch {
    return NextResponse.json({ error: 'Product slug already exists for this brand' }, { status: 400 });
  }
}
