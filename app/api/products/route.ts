export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const brandId = req.nextUrl.searchParams.get('brand') || 'loveintea';
  const products = db.prepare(
    'SELECT * FROM products WHERE brand_id=? ORDER BY sort_order'
  ).all(brandId);

  // Attach images count for each product
  const withImages = (products as Array<Record<string, unknown>>).map(p => {
    const imageCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM product_images WHERE product_id=?'
    ).get(p.id) as { cnt: number })?.cnt ?? 0;
    return { ...p, image_count: imageCount };
  });

  return NextResponse.json({ products: withImages });
}
