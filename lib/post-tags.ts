/**
 * Multi-tag every post across dimensions so the DB can later be aggregated to
 * find the winning combinations (segment × insight × behavior × template × …).
 * Tags are assigned at creation time (auto) and can be edited manually.
 */
import { getDb } from './db';

export type TagDimension =
  | 'segment' | 'insight' | 'behavior' | 'usp' | 'rtb' | 'narrative'
  | 'context' | 'product' | 'template' | 'format' | 'pillar' | 'purpose' | 'custom';

export interface PostTag { dimension: TagDimension | string; value: string; label?: string; source?: 'auto' | 'manual' }

/** Insert tags for a post (idempotent on post_id+dimension+value). */
export function addPostTags(postId: string, brandId: string, tags: PostTag[]) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO post_tags (post_id, brand_id, dimension, value, label, source) VALUES (?,?,?,?,?,?)`
  );
  const tx = db.transaction(() => {
    for (const t of tags) {
      const value = String(t.value ?? '').trim();
      if (!value) continue;
      stmt.run(postId, brandId, t.dimension, value, t.label ?? value, t.source ?? 'auto');
    }
  });
  tx();
}

/** Replace ALL manual tags for a post (keeps auto tags). Used by the manual editor. */
export function setManualTags(postId: string, brandId: string, tags: PostTag[]) {
  const db = getDb();
  db.prepare(`DELETE FROM post_tags WHERE post_id=? AND source='manual'`).run(postId);
  addPostTags(postId, brandId, tags.map(t => ({ ...t, source: 'manual' })));
}

export function getPostTags(postId: string): PostTag[] {
  return getDb().prepare(`SELECT dimension, value, label, source FROM post_tags WHERE post_id=? ORDER BY dimension`).all(postId) as PostTag[];
}

/**
 * Auto-tag a post from its structured columns + any extra targeting tags.
 * Call right after creating a post. Safe to call repeatedly.
 */
export function autoTagPost(postId: string, extra: PostTag[] = []) {
  const db = getDb();
  const p = db.prepare(
    `SELECT brand_id, sku_id, segment_id, rtb_id, usp_id, narrative_id, context_id, template_id, platforms FROM posts WHERE id=?`
  ).get(postId) as Record<string, string> | undefined;
  if (!p) return;
  const brandId = p.brand_id || 'loveintea';
  const tags: PostTag[] = [];
  const push = (dimension: string, value?: string | null) => { if (value && String(value).trim()) tags.push({ dimension, value: String(value), source: 'auto' }); };
  push('product', p.sku_id);
  push('segment', p.segment_id);
  push('usp', p.usp_id);
  push('rtb', p.rtb_id);
  push('narrative', p.narrative_id);
  push('context', p.context_id);
  push('template', p.template_id);
  addPostTags(postId, brandId, [...tags, ...extra]);
}

export interface TagPerfRow { dimension: string; value: string; label: string; posts: number; avg_engaged: number; avg_reach: number }

/** Win-rate per tag (dimension+value) from linked posts' metrics — the DB aggregation for optimisation. */
export function tagPerformance(brandId: string): TagPerfRow[] {
  return getDb().prepare(`
    SELECT pt.dimension, pt.value, MAX(pt.label) AS label,
      COUNT(DISTINCT p.id) AS posts,
      COALESCE(AVG(pm.engaged),0) AS avg_engaged,
      COALESCE(AVG(pm.reach),0)   AS avg_reach
    FROM post_tags pt
    JOIN posts p ON p.id = pt.post_id AND p.status='published'
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE pt.brand_id = ?
    GROUP BY pt.dimension, pt.value
    HAVING posts > 0
    ORDER BY pt.dimension, avg_engaged DESC
  `).all(brandId) as TagPerfRow[];
}
