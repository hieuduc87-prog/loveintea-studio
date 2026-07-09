export const dynamic = 'force-dynamic';
/**
 * GET  /api/products/[id]/knowledge — knowledge fields + shot requirements + photo coverage
 * PUT  /api/products/[id]/knowledge — save knowledge_json and/or shot_req_json
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEFAULT_KNOWLEDGE_FIELDS, getShotRequirements } from '@/lib/product-knowledge';
import { assertResourceBrand } from '@/lib/brand-guard';

/** 403 unless the caller is a member of the product's brand. */
function guardProduct(req: NextRequest, productId: string): NextResponse | null {
  const row = getDb().prepare('SELECT brand_id FROM products WHERE id=?').get(productId) as { brand_id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return assertResourceBrand(req, row.brand_id);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = guardProduct(req, params.id);
  if (denied) return denied;
  const db = getDb();
  const p = db.prepare('SELECT knowledge_json, shot_req_json FROM products WHERE id=?').get(params.id) as { knowledge_json: string; shot_req_json: string } | undefined;
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let knowledge: Record<string, string> = {};
  try { knowledge = JSON.parse(p.knowledge_json || '{}'); } catch { /* empty */ }
  const shotReqs = getShotRequirements(p);

  // Coverage: count product_images per type
  const counts: Record<string, number> = {};
  for (const r of db.prepare('SELECT type, COUNT(*) n FROM product_images WHERE product_id=? GROUP BY type').all(params.id) as Array<{ type: string; n: number }>) {
    counts[r.type] = r.n;
  }
  const coverage = shotReqs.map(s => ({ ...s, have: counts[s.type] ?? 0, ok: (counts[s.type] ?? 0) >= s.min }));

  return NextResponse.json({ fields: DEFAULT_KNOWLEDGE_FIELDS, knowledge, shotReqs, coverage });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = guardProduct(req, params.id);
  if (denied) return denied;
  const body = await req.json() as { knowledge?: Record<string, string>; shotReqs?: unknown[] };
  const db = getDb();
  const sets: string[] = []; const vals: unknown[] = [];
  if (body.knowledge) { sets.push('knowledge_json = ?'); vals.push(JSON.stringify(body.knowledge)); }
  if (body.shotReqs)  { sets.push('shot_req_json = ?'); vals.push(JSON.stringify(body.shotReqs)); }
  if (!sets.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  vals.push(params.id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}
