export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const p = req.nextUrl.searchParams;
  const brandId  = p.get('brand')   || 'loveintea';
  const productId = p.get('product') || '';
  const status   = p.get('status')  || '';
  const source   = p.get('source')  || '';
  const tagIds   = p.get('tags')?.split(',').filter(Boolean) || [];
  const limit    = Math.min(Number(p.get('limit') || 120), 500);
  const offset   = Number(p.get('offset') || 0);

  const where: string[] = ['a.brand_id = ?'];
  const params: unknown[] = [brandId];

  if (productId) { where.push('a.product_id = ?'); params.push(productId); }
  if (status)    { where.push('a.status = ?');     params.push(status); }
  if (source)    { where.push('a.source = ?');     params.push(source); }
  if (tagIds.length) {
    where.push(`EXISTS (
      SELECT 1 FROM asset_tags at3
      WHERE at3.asset_id = a.id
        AND at3.tag_id IN (${tagIds.map(() => '?').join(',')})
    )`);
    params.push(...tagIds);
  }

  const whereClause = where.join(' AND ');

  const rows = db.prepare(`
    SELECT
      a.*,
      p.name  AS product_name,
      p.color AS product_color,
      COALESCE(
        (SELECT json_group_array(json_object(
          'id', t.id, 'name', t.name, 'color', t.color,
          'type', t.type, 'slug', t.slug
        ))
         FROM asset_tags at2
         JOIN tags t ON t.id = at2.tag_id
         WHERE at2.asset_id = a.id),
        '[]'
      ) AS tags_json
    FROM assets a
    LEFT JOIN products p ON p.id = a.product_id
    WHERE ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<Record<string, unknown>>;

  const total = (db.prepare(
    `SELECT COUNT(*) as cnt FROM assets a WHERE ${whereClause}`
  ).get(...params) as { cnt: number })?.cnt ?? 0;

  const assets = rows.map(r => ({
    ...r,
    tags: JSON.parse(r.tags_json as string || '[]') as object[],
    tags_json: undefined,
  }));

  return NextResponse.json({ assets, total });
}
