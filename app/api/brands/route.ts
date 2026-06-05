export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const brands = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as product_count
    FROM brands b ORDER BY b.name
  `).all();
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json() as {
    name: string; slug?: string; domain?: string; logo_url?: string;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const slug = body.slug?.trim() ||
    body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = slug; // use slug as ID for readability

  try {
    db.prepare(`
      INSERT INTO brands (id, name, slug, logo_url, domain, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, body.name.trim(), slug, body.logo_url || null, body.domain || null);

    // Seed empty brand_dna
    db.prepare(`
      INSERT OR IGNORE INTO brand_dna (id, brand_id) VALUES (?, ?)
    `).run(uuid(), id);

    return NextResponse.json({ ok: true, id, slug });
  } catch {
    return NextResponse.json({ error: 'Brand slug already exists' }, { status: 400 });
  }
}
