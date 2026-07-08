export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertResourceBrand } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const asset = db.prepare(`
    SELECT a.*, p.name AS product_name, p.color AS product_color
    FROM assets a LEFT JOIN products p ON p.id = a.product_id
    WHERE a.id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, asset.brand_id as string | undefined);
  if (denied) return denied;

  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN asset_tags at2 ON at2.tag_id = t.id
    WHERE at2.asset_id = ?
  `).all(id);

  return NextResponse.json({ asset: { ...asset, tags } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const own = db.prepare('SELECT brand_id FROM assets WHERE id = ?').get(id) as { brand_id?: string } | undefined;
  if (!own) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, own.brand_id);
  if (denied) return denied;

  const body = await req.json() as {
    status?: string;
    notes?: string;
    product_id?: string | null;
    folder?: string;
    add_tags?: string[];
    remove_tags?: string[];
  };

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status); }
  if (body.notes  !== undefined) { sets.push('notes = ?');  vals.push(body.notes); }
  if (body.product_id !== undefined) { sets.push('product_id = ?'); vals.push(body.product_id); }
  if (body.folder !== undefined) { sets.push('folder = ?'); vals.push(body.folder); }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    db.prepare(`UPDATE assets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  if (body.add_tags?.length) {
    const ins = db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)');
    for (const tagId of body.add_tags) ins.run(id, tagId);
  }
  if (body.remove_tags?.length) {
    const del = db.prepare('DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?');
    for (const tagId of body.remove_tags) del.run(id, tagId);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const own = db.prepare('SELECT brand_id FROM assets WHERE id = ?').get(id) as { brand_id?: string } | undefined;
  if (!own) return NextResponse.json({ ok: true });
  const denied = assertResourceBrand(req, own.brand_id);
  if (denied) return denied;
  // Remove tag links first
  db.prepare('DELETE FROM asset_tags WHERE asset_id = ?').run(id);
  db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
