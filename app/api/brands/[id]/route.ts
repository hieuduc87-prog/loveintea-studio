export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { canAccessBrand, isAllBrands } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The path [id] IS the brand id — middleware only checks the query param, so
  // guard membership here or any tenant can read another store's brand + DNA.
  if (!canAccessBrand(req, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getDb();
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const products = db.prepare('SELECT * FROM products WHERE brand_id = ? ORDER BY sort_order').all(id);
  const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id = ?').get(id);
  return NextResponse.json({ brand, products, dna });
}

const DNA_COLUMNS = ['tagline', 'archetype', 'through_line', 'voice_traits', 'compliance_json',
  'hashtags', 'colors_json', 'typography_json', 'target_audience', 'insight', 'behavior', 'brand_rules',
  'content_language'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!canAccessBrand(req, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getDb();
  const body = await req.json() as Record<string, unknown> & { dna?: Record<string, unknown> };

  // Brand fields
  const allowed = ['name', 'slug', 'logo_url', 'domain'];
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length) { db.prepare(`UPDATE brands SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id); }

  // Brand DNA fields (upsert)
  if (body.dna && typeof body.dna === 'object') {
    const dnaSets: string[] = []; const dnaVals: unknown[] = [];
    for (const [k, v] of Object.entries(body.dna)) {
      if (DNA_COLUMNS.includes(k)) { dnaSets.push(`${k} = ?`); dnaVals.push(typeof v === 'object' ? JSON.stringify(v) : v); }
    }
    if (dnaSets.length) {
      const exists = db.prepare('SELECT 1 FROM brand_dna WHERE brand_id=?').get(id);
      if (exists) {
        db.prepare(`UPDATE brand_dna SET ${dnaSets.join(', ')}, updated_at=datetime('now') WHERE brand_id=?`).run(...dnaVals, id);
      } else {
        db.prepare(`INSERT INTO brand_dna (id, brand_id, ${Object.keys(body.dna).filter(k => DNA_COLUMNS.includes(k)).join(', ')})
          VALUES (?, ?, ${dnaVals.map(() => '?').join(', ')})`).run(`dna-${id}`, id, ...dnaVals);
      }
    }
  }

  if (!sets.length && !body.dna) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Deleting a whole tenant is a platform action — super-admin only.
  if (!isAllBrands(req)) return NextResponse.json({ error: 'Forbidden — chỉ super-admin được xóa store.' }, { status: 403 });
  if (id === 'loveintea') return NextResponse.json({ error: 'Cannot delete default brand' }, { status: 400 });
  const db = getDb();
  db.prepare('DELETE FROM brands WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
