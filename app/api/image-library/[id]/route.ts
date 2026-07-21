export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

// Only these columns may be patched. NEVER interpolate client-supplied object
// keys as column identifiers — that is SQL injection via the SET clause.
const PATCHABLE = new Set([
  'sku_id', 'usp_id', 'context_id', 'prompt', 'tags', 'is_favorite', 'used_in_post',
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = getDb();
  const body = await req.json() as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [k, v] of Object.entries(body)) {
    if (!PATCHABLE.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  // TENANT ISOLATION: chỉ sửa ảnh của brand mình (WHERE …AND brand_id=?).
  vals.push(params.id, getBrandId(req) || 'loveintea');
  const r = db.prepare(`UPDATE image_library SET ${sets.join(', ')} WHERE id = ? AND brand_id = ?`).run(...vals);
  if (r.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const r = db.prepare('DELETE FROM image_library WHERE id = ? AND brand_id = ?')
    .run(params.id, getBrandId(req) || 'loveintea');
  if (r.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
