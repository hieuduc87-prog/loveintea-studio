export const dynamic = 'force-dynamic';
/**
 * Lịch video định kỳ — CRUD.
 * GET    /api/video/schedules
 * POST   — tạo lịch mới (chạy lần đầu ngay lần tick tới: next_run_at = null)
 * PATCH  — { id, ...fields } (column allowlist)
 * DELETE /api/video/schedules?id=x
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { computeNextRun } from '@/lib/video/schedule';

const EDITABLE = new Set([
  'name', 'product_strategy', 'product_id', 'purpose', 'target_duration_s', 'use_voiceover',
  'language', 'inspiration_item_id', 'cadence_days', 'hour_local', 'auto_post', 'platforms', 'enabled',
  'bgm_mode',
]);

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const schedules = getDb().prepare(
    `SELECT vs.*,
       (SELECT COUNT(*) FROM video_projects vp WHERE vp.schedule_id = vs.id) AS video_count,
       (SELECT COUNT(*) FROM video_projects vp WHERE vp.schedule_id = vs.id AND vp.status IN ('queued','rendering')) AS pending_count
     FROM video_schedules vs WHERE vs.brand_id=? ORDER BY vs.created_at DESC`
  ).all(brandId);
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const b = await req.json() as Record<string, unknown>;
    const id = uuid();
    const cadence = Math.min(30, Math.max(1, Number(b.cadence_days) || 3));
    const hourNum = Number(b.hour_local);
    const hour = Math.min(23, Math.max(0, Number.isFinite(hourNum) ? hourNum : 9));
    getDb().prepare(`INSERT INTO video_schedules
      (id, brand_id, name, product_strategy, product_id, purpose, target_duration_s, use_voiceover,
       language, inspiration_item_id, cadence_days, hour_local, auto_post, platforms, bgm_mode, enabled, next_run_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,NULL)`)
      .run(id, brandId,
        String(b.name || 'Video định kỳ'),
        b.product_strategy === 'fixed' ? 'fixed' : 'rotate',
        (b.product_id as string) || null,
        String(b.purpose || 'promo'),
        Math.min(60, Math.max(10, Number(b.target_duration_s) || 20)),
        b.use_voiceover === false ? 0 : 1,
        (b.language as string) || null,
        (b.inspiration_item_id as string) || null,
        cadence, hour,
        b.auto_post === 'auto' ? 'auto' : 'draft',
        String(b.platforms || 'facebook'),
        b.bgm_mode === 'none' ? 'none' : 'auto');
    // next_run_at NULL → video đầu tiên được tạo ngay lần tick tới (≤5 phút)
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const b = await req.json() as Record<string, unknown> & { id?: string };
    if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const db = getDb();
    const row = db.prepare('SELECT id, cadence_days, hour_local FROM video_schedules WHERE id=? AND brand_id=?')
      .get(b.id, brandId) as { id: string; cadence_days: number; hour_local: number } | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(b)) {
      if (!EDITABLE.has(k)) continue;
      sets.push(`${k}=?`);
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return NextResponse.json({ error: 'no editable fields' }, { status: 400 });
    // Đổi nhịp/giờ → tính lại lần chạy kế tiếp
    if (b.cadence_days !== undefined || b.hour_local !== undefined) {
      sets.push('next_run_at=?');
      vals.push(computeNextRun(Number(b.cadence_days ?? row.cadence_days), Number(b.hour_local ?? row.hour_local)));
    }
    sets.push(`updated_at=datetime('now')`);
    db.prepare(`UPDATE video_schedules SET ${sets.join(', ')} WHERE id=? AND brand_id=?`).run(...vals, b.id, brandId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const brandId = getBrandId(req);
  const db = getDb();
  const row = db.prepare('SELECT id FROM video_schedules WHERE id=? AND brand_id=?').get(id, brandId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare('DELETE FROM video_schedules WHERE id=? AND brand_id=?').run(id, brandId);
  return NextResponse.json({ ok: true });
}
