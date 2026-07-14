export const dynamic = 'force-dynamic';
/**
 * GET    /api/video/recipe-batches/[id] — chi tiết batch: clip theo nhóm món + projects
 * PATCH  /api/video/recipe-batches/[id] — sửa name / grade_json
 * DELETE /api/video/recipe-batches/[id] — xoá batch + clip nguồn (project & video output giữ lại)
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { IMAGES_DIR } from '@/lib/video/ffmpeg';

function getOwnedBatch(req: NextRequest, id: string) {
  const brandId = getBrandId(req);
  const batch = getDb().prepare('SELECT * FROM recipe_batches WHERE id=? AND brand_id=?').get(id, brandId) as Record<string, string> | undefined;
  return { brandId, batch };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { batch } = getOwnedBatch(req, params.id);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const db = getDb();
  const clips = db.prepare(
    `SELECT id, url, filename, duration_s, group_name, status, recipe_json FROM video_clips
     WHERE batch_id=? ORDER BY group_name, filename`
  ).all(params.id);
  const projects = db.prepare(
    `SELECT id, title, dish_name, version_label, status, output_url, error, created_at FROM video_projects
     WHERE batch_id=? ORDER BY dish_name, version_label`
  ).all(params.id);
  return NextResponse.json({ batch, clips, projects });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { batch } = getOwnedBatch(req, params.id);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json() as { name?: string; gradeJson?: Record<string, number> };
  const db = getDb();
  if (typeof body.name === 'string') db.prepare('UPDATE recipe_batches SET name=? WHERE id=?').run(body.name.slice(0, 80), params.id);
  if (body.gradeJson && typeof body.gradeJson === 'object') {
    db.prepare('UPDATE recipe_batches SET grade_json=? WHERE id=?').run(JSON.stringify(body.gradeJson), params.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { batch } = getOwnedBatch(req, params.id);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const db = getDb();
  const clips = db.prepare('SELECT filename FROM video_clips WHERE batch_id=?').all(params.id) as Array<{ filename: string }>;
  for (const c of clips) { try { fs.unlinkSync(path.join(IMAGES_DIR, c.filename)); } catch { /* gone */ } }
  db.prepare('DELETE FROM video_clips WHERE batch_id=?').run(params.id);
  db.prepare('DELETE FROM recipe_batches WHERE id=?').run(params.id);
  return NextResponse.json({ ok: true, removedClips: clips.length });
}
