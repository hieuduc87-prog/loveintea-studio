export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db      = getDb();
  const skuId   = req.nextUrl.searchParams.get('sku');
  const uspId   = req.nextUrl.searchParams.get('usp');
  const fav     = req.nextUrl.searchParams.get('fav');
  const limit   = parseInt(req.nextUrl.searchParams.get('limit') ?? '60');

  let sql = 'SELECT * FROM image_library WHERE 1=1';
  const params: (string | number)[] = [];

  if (skuId)            { sql += ' AND sku_id=?';       params.push(skuId); }
  if (uspId)            { sql += ' AND usp_id=?';        params.push(uspId); }
  if (fav === '1')      { sql += ' AND is_favorite=1';                        }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const images = db.prepare(sql).all(...params);
  return NextResponse.json({ images });
}
