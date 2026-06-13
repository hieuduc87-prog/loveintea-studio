/**
 * Template operating flow — rotation + performance-biased picking.
 *
 * When Plan/Single generation picks a template, we want to (a) rotate so the
 * same template isn't reused every time, and (b) lean toward templates that win.
 * Score = winRate*W − recencyPenalty. Win rate is derived from the engagement
 * of posts already linked to each template (post_metrics). With no history yet,
 * it degrades to pure least-recently-used rotation.
 */
import { getDb } from './db';

export interface PickedTemplate {
  id: string; name: string; image_url: string; analysis: string;
  format: string; category: string; aspect_ratio: string; kind: string;
}

export interface TemplatePerf {
  id: string; name: string; image_url: string; category: string; format: string; kind: string;
  usage_count: number; posts: number; avg_engaged: number; avg_reach: number; win: boolean;
}

/** Per-template performance from linked posts' metrics (best-effort). */
export function getTemplatePerformance(brandId: string): TemplatePerf[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.id, t.name, t.image_url, t.category, t.format, t.kind, t.usage_count,
      COUNT(DISTINCT p.id) AS posts,
      COALESCE(AVG(pm.engaged), 0) AS avg_engaged,
      COALESCE(AVG(pm.reach), 0)   AS avg_reach
    FROM content_templates t
    LEFT JOIN posts p ON p.template_id = t.id AND p.status='published'
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE t.brand_id = ? AND t.is_active = 1
    GROUP BY t.id
    ORDER BY avg_engaged DESC
  `).all(brandId) as Array<Omit<TemplatePerf, 'win'>>;

  // Win = engagement above the median of templates that actually have data
  const withData = rows.filter(r => r.posts > 0).map(r => r.avg_engaged).sort((a, b) => a - b);
  const median = withData.length ? withData[Math.floor(withData.length / 2)] : 0;
  return rows.map(r => ({ ...r, win: r.posts > 0 && r.avg_engaged >= median && median > 0 }));
}

/**
 * Pick one template for a brand with optional format/category/kind constraints.
 * Rotation: prefer winners, then least-recently-used. Returns null if none.
 * Does NOT mark usage — call recordTemplateUse() once a post is actually created.
 */
export function pickTemplate(brandId: string, opts: { format?: string; category?: string; kind?: string } = {}): PickedTemplate | null {
  const db = getDb();
  const where: string[] = ['t.brand_id = ?', 't.is_active = 1'];
  const params: unknown[] = [brandId];
  if (opts.format)   { where.push('t.format = ?');   params.push(opts.format); }
  if (opts.category) { where.push('t.category = ?'); params.push(opts.category); }
  if (opts.kind)     { where.push('t.kind = ?');     params.push(opts.kind); }

  const rows = db.prepare(`
    SELECT t.id, t.name, t.image_url, t.analysis, t.format, t.category, t.aspect_ratio,
           t.kind, t.usage_count, t.last_used_at,
           COALESCE(AVG(pm.engaged),0) AS avg_engaged, COUNT(pm.id) AS metric_rows
    FROM content_templates t
    LEFT JOIN posts p ON p.template_id = t.id AND p.status='published'
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE ${where.join(' AND ')}
    GROUP BY t.id
  `).all(...params) as Array<PickedTemplate & { usage_count: number; last_used_at: string | null; avg_engaged: number; metric_rows: number }>;

  if (!rows.length) return null;

  const maxEng = Math.max(1, ...rows.map(r => r.avg_engaged));
  const now = Date.now();
  const scored = rows.map(r => {
    const winScore = r.metric_rows > 0 ? (r.avg_engaged / maxEng) : 0;           // 0..1, performance bias
    const ageDays = r.last_used_at ? (now - new Date(r.last_used_at).getTime()) / 86_400_000 : 999;
    const recency = Math.min(1, ageDays / 7);                                    // 0..1, fresher rotation gets higher
    // 60% performance + 40% rotation; never-used (last_used_at null) floats up via recency=1
    return { r, score: winScore * 0.6 + recency * 0.4 - r.usage_count * 0.001 };
  }).sort((a, b) => b.score - a.score);

  const { r } = scored[0];
  return { id: r.id, name: r.name, image_url: r.image_url, analysis: r.analysis, format: r.format, category: r.category, aspect_ratio: r.aspect_ratio, kind: r.kind };
}

export function recordTemplateUse(templateId: string) {
  getDb().prepare(`UPDATE content_templates SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?`).run(templateId);
}
