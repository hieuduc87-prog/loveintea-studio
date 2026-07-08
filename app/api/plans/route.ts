export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const db = getDb();
  const brand = getBrandId(req);
  const includeItems = req.nextUrl.searchParams.get('include_items') === '1';
  const plans = db.prepare(`
    SELECT cp.*,
      (SELECT COUNT(*) FROM plan_items WHERE plan_id = cp.id) AS item_count,
      (SELECT COUNT(*) FROM posts WHERE plan_id = cp.id) AS post_count,
      (SELECT COUNT(*) FROM posts WHERE plan_id = cp.id AND status = 'scheduled') AS scheduled_count,
      (SELECT COUNT(*) FROM posts WHERE plan_id = cp.id AND status = 'published') AS published_count
    FROM content_plans cp
    WHERE cp.brand_id = ?
    ORDER BY cp.created_at DESC
  `).all(brand) as Record<string, unknown>[];

  if (includeItems) {
    for (const plan of plans) {
      plan.items = db.prepare(
        'SELECT * FROM plan_items WHERE plan_id = ? ORDER BY sort_order'
      ).all(plan.id as string);
    }
  }

  return NextResponse.json({ plans });
}
