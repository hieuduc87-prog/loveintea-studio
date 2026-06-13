export const dynamic = 'force-dynamic';
/**
 * POST /api/video/projects/[id]/render — enqueue render.
 * The background scheduler picks up `queued` projects one at a time
 * (2 vCPU server — strictly sequential renders).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const p = db.prepare('SELECT status FROM video_projects WHERE id=?').get(params.id) as { status: string } | undefined;
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (p.status === 'rendering' || p.status === 'queued') {
    return NextResponse.json({ ok: true, status: p.status });
  }
  db.prepare(`UPDATE video_projects SET status='queued', error=NULL, updated_at=datetime('now') WHERE id=?`).run(params.id);
  return NextResponse.json({ ok: true, status: 'queued' });
}
