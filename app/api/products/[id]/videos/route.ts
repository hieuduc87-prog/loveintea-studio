export const dynamic = 'force-dynamic';
/** Per-product video clip library (uploaded via chunked /api/upload/chunk). */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { IMAGES_DIR } from '@/lib/video/ffmpeg';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const clips = getDb().prepare(
    'SELECT * FROM video_clips WHERE product_id=? ORDER BY created_at DESC'
  ).all(params.id);
  return NextResponse.json({ clips });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const clipId = req.nextUrl.searchParams.get('clipId');
  if (!clipId) return NextResponse.json({ error: 'clipId required' }, { status: 400 });
  const db = getDb();
  const row = db.prepare('SELECT filename FROM video_clips WHERE id=? AND product_id=?').get(clipId, params.id) as { filename: string } | undefined;
  if (row) { try { fs.unlinkSync(path.join(IMAGES_DIR, row.filename)); } catch { /* gone */ } }
  db.prepare('DELETE FROM video_clips WHERE id=?').run(clipId);
  return NextResponse.json({ ok: true });
}
