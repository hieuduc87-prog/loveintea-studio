export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const p = req.nextUrl.searchParams;
  const brandId   = p.get('brand')   || 'loveintea';
  const productId = p.get('product') || '';
  const status    = p.get('status')  || '';
  const platform  = p.get('platform')|| '';
  const limit     = Math.min(Number(p.get('limit') || 50), 200);
  const offset    = Number(p.get('offset') || 0);

  const where: string[] = ['cl.brand_id = ?'];
  const params: unknown[] = [brandId];

  if (productId) { where.push('cl.product_id = ?');  params.push(productId); }
  if (status)    { where.push('cl.status = ?');       params.push(status); }
  if (platform)  { where.push('cl.platform = ?');     params.push(platform); }

  const rows = db.prepare(`
    SELECT cl.*, p.name AS product_name, p.color AS product_color
    FROM content_log cl
    LEFT JOIN products p ON p.id = cl.product_id
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(cl.aired_at, cl.scheduled_at, cl.created_at) DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = (db.prepare(
    `SELECT COUNT(*) as cnt FROM content_log cl WHERE ${where.join(' AND ')}`
  ).get(...params) as { cnt: number })?.cnt ?? 0;

  return NextResponse.json({ items: rows, total });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json() as {
    brand_id?: string;
    product_id?: string;
    title?: string;
    caption?: string;
    content_type?: string;
    platform?: string;
    status?: string;
    scheduled_at?: string;
    aired_at?: string;
    post_url?: string;
    notes?: string;
    asset_ids?: string[];
  };

  const id = uuid();
  const brandId = body.brand_id || 'loveintea';

  db.prepare(`
    INSERT INTO content_log
      (id, brand_id, product_id, title, caption, content_type, platform, status,
       scheduled_at, aired_at, post_url, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), datetime('now'))
  `).run(
    id, brandId, body.product_id || null,
    body.title || null, body.caption || null,
    body.content_type || 'post', body.platform || 'instagram',
    body.status || 'draft',
    body.scheduled_at || null, body.aired_at || null,
    body.post_url || null, body.notes || null
  );

  if (body.asset_ids?.length) {
    const ins = db.prepare('INSERT OR IGNORE INTO content_log_assets (content_id, asset_id) VALUES (?,?)');
    for (const aid of body.asset_ids) ins.run(id, aid);
  }

  return NextResponse.json({ ok: true, id });
}
