export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = getDb();
  const body = await req.json() as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [k, v] of Object.entries(body)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(params.id);
  db.prepare(`UPDATE image_library SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM image_library WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}
