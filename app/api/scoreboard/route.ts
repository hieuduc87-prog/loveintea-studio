export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

// GET /api/scoreboard?brandId=X — get scoreboard with verdicts
export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brandId') || 'loveintea';
    const db = getDb();

    // Get current scoreboard entries
    const entries = db.prepare(
      `SELECT * FROM scoreboard WHERE brand_id = ? ORDER BY verdict ASC, sample_size DESC`
    ).all(brandId) as Array<Record<string, unknown>>;

    // Get summary stats
    const stats = {
      total: entries.length,
      scale: entries.filter((e: Record<string, unknown>) => e.verdict === 'SCALE').length,
      hold: entries.filter((e: Record<string, unknown>) => e.verdict === 'HOLD').length,
      retire: entries.filter((e: Record<string, unknown>) => e.verdict === 'RETIRE').length,
    };

    // Check if we have enough data to compute verdicts
    const postCount = (db.prepare(
      `SELECT COUNT(*) as n FROM posts WHERE brand_id = ? AND status = 'published'`
    ).get(brandId) as { n: number }).n;

    return NextResponse.json({
      entries,
      stats,
      postCount,
      hasEnoughData: postCount >= 10,
      message: postCount < 10
        ? `Need ${10 - postCount} more published posts before scoreboard can compute verdicts. Currently all angles are HOLD.`
        : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/scoreboard — manually update or recompute scoreboard
export async function POST(req: NextRequest) {
  try {
    const { brandId, action } = await req.json() as { brandId?: string; action?: string };
    const bid = brandId || 'loveintea';
    const db = getDb();

    if (action === 'recompute') {
      // Compute verdicts from post performance data
      // Group by cell_id (angle) and compute saves, reach, ER
      const angles = db.prepare(`
        SELECT
          p.cell_id as angle,
          CASE WHEN p.platforms LIKE '%instagram%' THEN 'instagram' ELSE 'facebook' END as channel,
          COUNT(*) as sample_size,
          COALESCE(SUM(pm.saves), 0) as total_saves,
          COALESCE(AVG(pm.reach), 0) as avg_reach,
          CASE WHEN COALESCE(AVG(pm.reach), 0) > 0
            THEN COALESCE(AVG(pm.engaged), 0) * 100.0 / COALESCE(AVG(pm.reach), 1)
            ELSE 0 END as er
        FROM posts p
        LEFT JOIN post_metrics pm ON pm.post_id = p.id
        WHERE p.brand_id = ? AND p.status = 'published' AND p.cell_id IS NOT NULL AND p.cell_id != ''
        GROUP BY p.cell_id, channel
        HAVING sample_size >= 2
      `).all(bid) as Array<{
        angle: string; channel: string; sample_size: number;
        total_saves: number; avg_reach: number; er: number;
      }>;

      // Compute baseline (average across all angles)
      const totalSaves = angles.reduce((s, a) => s + a.total_saves, 0);
      const totalSamples = angles.reduce((s, a) => s + a.sample_size, 0);
      const savesBaseline = totalSamples > 0 ? totalSaves / totalSamples : 0;
      const MIN_SAVES_FLOOR = 2; // Absolute floor — must have at least 2 saves
      const MIN_SAMPLE = 3;

      const upsert = db.prepare(`
        INSERT INTO scoreboard (id, brand_id, angle, channel, saves, reach, er, sample_size, verdict, evidence_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(brand_id, angle, channel)
        DO UPDATE SET saves=?, reach=?, er=?, sample_size=?, verdict=?, evidence_json=?, updated_at=datetime('now')
      `);

      let updated = 0;
      for (const a of angles) {
        let verdict = 'HOLD';
        if (a.sample_size >= MIN_SAMPLE) {
          const avgSaves = a.total_saves / a.sample_size;
          if (avgSaves >= MIN_SAVES_FLOOR && avgSaves >= savesBaseline * 1.2) {
            verdict = 'SCALE';
          } else if (avgSaves < MIN_SAVES_FLOOR && a.sample_size >= MIN_SAMPLE) {
            verdict = 'RETIRE';
          }
        }

        const evidence = JSON.stringify({
          savesBaseline: Math.round(savesBaseline * 10) / 10,
          avgSaves: Math.round(a.total_saves / a.sample_size * 10) / 10,
          minFloor: MIN_SAVES_FLOOR,
        });

        upsert.run(
          uuid(), bid, a.angle, a.channel, a.total_saves, Math.round(a.avg_reach), Math.round(a.er * 100) / 100, a.sample_size, verdict, evidence,
          a.total_saves, Math.round(a.avg_reach), Math.round(a.er * 100) / 100, a.sample_size, verdict, evidence
        );
        updated++;
      }

      return NextResponse.json({ ok: true, updated, anglesFound: angles.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
