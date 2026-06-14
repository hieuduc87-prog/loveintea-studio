export const dynamic = 'force-dynamic';
/**
 * GET /api/dashboard/detailed?brand=x — rich metrics for the detailed dashboard:
 * per-product performance, top engaged posts, weekly growth, tag winners, totals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tagPerformance } from '@/lib/post-tags';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brand') || 'loveintea';
  const db = getDb();

  // Per-product performance (published posts + avg engagement)
  const perProduct = db.prepare(`
    SELECT pr.id, pr.name, pr.color,
      COUNT(DISTINCT p.id) AS posts,
      COUNT(DISTINCT CASE WHEN p.status='published' THEN p.id END) AS published,
      COALESCE(AVG(pm.engaged),0) AS avg_engaged,
      COALESCE(SUM(pm.reach),0)   AS total_reach
    FROM products pr
    LEFT JOIN posts p ON (p.sku_id = pr.id OR p.sku_id = pr.slug) AND p.brand_id = pr.brand_id
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE pr.brand_id = ?
    GROUP BY pr.id ORDER BY avg_engaged DESC
  `).all(brandId);

  // Top engaged posts
  const topPosts = db.prepare(`
    SELECT p.id, p.caption, p.image_url, p.sku_id, p.published_at,
      MAX(pm.engaged) AS engaged, MAX(pm.reach) AS reach,
      MAX(pm.reactions) AS reactions, MAX(pm.comments) AS comments, MAX(pm.shares) AS shares
    FROM posts p JOIN post_metrics pm ON pm.post_id = p.id
    WHERE p.brand_id = ? AND p.status='published'
    GROUP BY p.id ORDER BY engaged DESC LIMIT 6
  `).all(brandId);

  // Weekly growth — published posts + avg engaged per ISO week (last 8 weeks)
  const weekly = db.prepare(`
    SELECT strftime('%Y-%W', p.published_at) AS week,
      COUNT(DISTINCT p.id) AS posts,
      COALESCE(AVG(pm.engaged),0) AS avg_engaged,
      COALESCE(SUM(pm.reach),0)   AS reach
    FROM posts p LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE p.brand_id = ? AND p.status='published' AND p.published_at > datetime('now','-56 days')
    GROUP BY week ORDER BY week ASC
  `).all(brandId);

  // Totals
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM posts WHERE brand_id=?) AS total_posts,
      (SELECT COUNT(*) FROM posts WHERE brand_id=? AND status='published') AS published,
      (SELECT COALESCE(SUM(reach),0) FROM post_metrics pm JOIN posts p ON p.id=pm.post_id WHERE p.brand_id=?) AS total_reach,
      (SELECT COALESCE(SUM(engaged),0) FROM post_metrics pm JOIN posts p ON p.id=pm.post_id WHERE p.brand_id=?) AS total_engaged,
      (SELECT COALESCE(SUM(comments),0) FROM post_metrics pm JOIN posts p ON p.id=pm.post_id WHERE p.brand_id=?) AS total_comments
  `).get(brandId, brandId, brandId, brandId, brandId);

  // Tag winners (top 3 per key dimension)
  const allTagPerf = tagPerformance(brandId);
  const tagWinners: Record<string, typeof allTagPerf> = {};
  for (const r of allTagPerf) {
    if (!['segment', 'insight', 'behavior', 'format', 'usp'].includes(r.dimension)) continue;
    (tagWinners[r.dimension] ||= []);
    if (tagWinners[r.dimension].length < 3) tagWinners[r.dimension].push(r);
  }

  return NextResponse.json({ perProduct, topPosts, weekly, totals, tagWinners });
}
