export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
  vals.push(params.id);
  db.prepare(`UPDATE image_library SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM image_library WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}
