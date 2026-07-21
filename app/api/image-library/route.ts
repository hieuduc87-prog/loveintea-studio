export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const db      = getDb();
  const brandId = getBrandId(req) || 'loveintea';
  const skuId   = req.nextUrl.searchParams.get('sku');
  const uspId   = req.nextUrl.searchParams.get('usp');
  const fav     = req.nextUrl.searchParams.get('fav');
  const limit   = parseInt(req.nextUrl.searchParams.get('limit') ?? '60');

  // TENANT ISOLATION: kho ảnh scope theo brand tin cậy (trước dùng chung mọi brand).
  let sql = 'SELECT * FROM image_library WHERE brand_id=?';
  const params: (string | number)[] = [brandId];

  if (skuId)            { sql += ' AND sku_id=?';       params.push(skuId); }
  if (uspId)            { sql += ' AND usp_id=?';        params.push(uspId); }
  if (fav === '1')      { sql += ' AND is_favorite=1';                        }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const images = db.prepare(sql).all(...params);
  return NextResponse.json({ images });
}
