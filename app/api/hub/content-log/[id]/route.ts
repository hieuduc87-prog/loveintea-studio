export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertResourceBrand } from '@/lib/brand-guard';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const own = db.prepare('SELECT brand_id FROM content_log WHERE id = ?').get(id) as { brand_id?: string } | undefined;
  if (!own) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, own.brand_id);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;

  const allowed = ['title','caption','content_type','platform','status',
                   'scheduled_at','aired_at','post_url','notes','product_id'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v ?? null); }
  }
  if (!sets.length && !Array.isArray(body.asset_ids)) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    db.prepare(`UPDATE content_log SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  if (Array.isArray(body.asset_ids)) {
    db.prepare('DELETE FROM content_log_assets WHERE content_id = ?').run(id);
    const ins = db.prepare('INSERT OR IGNORE INTO content_log_assets (content_id, asset_id) VALUES (?,?)');
    for (const aid of body.asset_ids as string[]) ins.run(id, aid);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const own = db.prepare('SELECT brand_id FROM content_log WHERE id = ?').get(id) as { brand_id?: string } | undefined;
  if (!own) return NextResponse.json({ ok: true });
  const denied = assertResourceBrand(req, own.brand_id);
  if (denied) return denied;
  db.prepare('DELETE FROM content_log_assets WHERE content_id = ?').run(id);
  db.prepare('DELETE FROM content_log WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
