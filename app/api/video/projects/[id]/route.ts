export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const p = getDb().prepare('SELECT * FROM video_projects WHERE id=?').get(params.id);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(p);
}

const PATCHABLE = new Set(['title', 'purpose', 'script_json', 'bgm_url', 'target_duration_s', 'status']);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json() as Record<string, unknown>;
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (!PATCHABLE.has(k)) continue;
    sets.push(`${k} = ?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
  }
  if (!sets.length) return NextResponse.json({ error: 'no patchable fields' }, { status: 400 });
  sets.push("updated_at = datetime('now')");
  vals.push(params.id);
  getDb().prepare(`UPDATE video_projects SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  getDb().prepare('DELETE FROM video_projects WHERE id=?').run(params.id);
  return NextResponse.json({ ok: true });
}
