export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const plans = db.prepare(`
    SELECT cp.*,
      (SELECT COUNT(*) FROM plan_items WHERE plan_id = cp.id) AS item_count,
      (SELECT COUNT(*) FROM posts WHERE plan_id = cp.id) AS post_count,
      (SELECT COUNT(*) FROM posts WHERE plan_id = cp.id AND status = 'scheduled') AS scheduled_count,
      (SELECT COUNT(*) FROM posts WHERE plan_id = cp.id AND status = 'published') AS published_count
    FROM content_plans cp
    ORDER BY cp.created_at DESC
  `).all();
  return NextResponse.json({ plans });
}
