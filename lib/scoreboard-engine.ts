/**
 * Scoreboard recompute engine — shared by /api/scoreboard (manual button)
 * and lib/scheduler.ts (automatic 6h cycle).
 *
 * Groups published posts by cell_id (angle) × channel, computes saves/reach/ER
 * from post_metrics, and assigns SCALE / HOLD / RETIRE verdicts.
 */
import { v4 as uuid } from 'uuid';
import { getDb } from './db';

export function recomputeScoreboard(brandId: string): { updated: number; anglesFound: number } {
  const db = getDb();

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
  `).all(brandId) as Array<{
    angle: string; channel: string; sample_size: number;
    total_saves: number; avg_reach: number; er: number;
  }>;

  const totalSaves = angles.reduce((s, a) => s + a.total_saves, 0);
  const totalSamples = angles.reduce((s, a) => s + a.sample_size, 0);
  const savesBaseline = totalSamples > 0 ? totalSaves / totalSamples : 0;
  const MIN_SAVES_FLOOR = 2;
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
      uuid(), brandId, a.angle, a.channel, a.total_saves, Math.round(a.avg_reach), Math.round(a.er * 100) / 100, a.sample_size, verdict, evidence,
      a.total_saves, Math.round(a.avg_reach), Math.round(a.er * 100) / 100, a.sample_size, verdict, evidence
    );
    updated++;
  }

  return { updated, anglesFound: angles.length };
}
