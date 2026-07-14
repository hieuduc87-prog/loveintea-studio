export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * POST /api/video/recipe-batches/[id]/generate — dựng video cho 1 món trong batch
 * body: { dish: string, versions?: number (1-3), language?: 'en'|'vi', bgmUrl?: string }
 * Mỗi version = 1 bản dựng khác nhau thật (Original 1, Original 2…) → queued, render tuần tự.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { buildRecipeStoryboard, PRODUCT_GROUP } from '@/lib/video/recipe-workflow';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const limited = enforceRateLimit(req, { scope: 'ai:video', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const brandId = getBrandId(req);
    const db = getDb();
    const batch = db.prepare('SELECT * FROM recipe_batches WHERE id=? AND brand_id=?').get(params.id, brandId) as
      { id: string; grade_json: string } | undefined;
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json() as { dish?: string; versions?: number; language?: string; bgmUrl?: string };
    const dish = String(body.dish || '').trim();
    if (!dish || dish === PRODUCT_GROUP) return NextResponse.json({ error: 'dish required' }, { status: 400 });
    const versions = Math.min(3, Math.max(1, Number(body.versions) || 2));

    const tagging = db.prepare(
      `SELECT COUNT(*) c FROM video_clips WHERE batch_id=? AND group_name IN (?, ?) AND status='tagging'`
    ).get(params.id, dish, PRODUCT_GROUP) as { c: number };
    if (tagging.c > 0) {
      return NextResponse.json({ error: `AI đang phân loại ${tagging.c} clip — chờ xong rồi dựng (tự refresh sau ~1 phút)` }, { status: 409 });
    }

    const created: string[] = [];
    for (let v = 0; v < versions; v++) {
      const board = await buildRecipeStoryboard({ batchId: params.id, brandId, dish, version: v, language: body.language });
      const projectId = uuid();
      const label = `Original ${v + 1}`;
      db.prepare(`INSERT INTO video_projects
        (id, brand_id, title, purpose, target_duration_s, bgm_url, script_json, status,
         template, batch_id, dish_name, version_label, grade_json)
        VALUES (?,?,?,?,?,?,?, 'queued', 'bazan_recipe', ?,?,?,?)`)
        .run(projectId, brandId, `${board.title} — ${label}`, 'promo',
          Math.round(board.segments.reduce((a, s) => a + s.dur_s, 0)),
          body.bgmUrl || null, JSON.stringify(board),
          params.id, board.title, label, batch.grade_json);
      created.push(projectId);
    }
    return NextResponse.json({ ok: true, projects: created });
  } catch (e) {
    console.error('[api recipe generate]', e);
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
