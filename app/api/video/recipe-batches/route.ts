export const dynamic = 'force-dynamic';
/**
 * Recipe Batch (Bazan viral recipe workflow)
 * GET  /api/video/recipe-batches — list batch của brand (kèm số món/clip/project)
 * POST /api/video/recipe-batches — tạo batch mới {name, gradeJson?}
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { DEFAULT_GRADE, PRODUCT_GROUP } from '@/lib/video/recipe-workflow';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const db = getDb();
  const batches = db.prepare(
    `SELECT b.*,
       (SELECT COUNT(DISTINCT group_name) FROM video_clips c WHERE c.batch_id=b.id AND c.group_name IS NOT NULL AND c.group_name != ?) dishes,
       (SELECT COUNT(*) FROM video_clips c WHERE c.batch_id=b.id) clips,
       (SELECT COUNT(*) FROM video_projects p WHERE p.batch_id=b.id) projects
     FROM recipe_batches b WHERE b.brand_id=? ORDER BY b.created_at DESC LIMIT 50`
  ).all(PRODUCT_GROUP, brandId);
  return NextResponse.json({ batches });
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const body = await req.json() as { name?: string; gradeJson?: Record<string, number> };
    const id = uuid();
    const grade = { ...DEFAULT_GRADE, ...(body.gradeJson ?? {}) };
    getDb().prepare(
      `INSERT INTO recipe_batches (id, brand_id, name, grade_json) VALUES (?,?,?,?)`
    ).run(id, brandId, (body.name || `Batch ${new Date().toISOString().slice(0, 10)}`).slice(0, 80), JSON.stringify(grade));
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
