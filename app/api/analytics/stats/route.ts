export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const db = getDb();
  const brand = getBrandId(req) || 'loveintea';
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM posts
    WHERE brand_id = ?
    GROUP BY status
  `).all(brand) as { status: string; count: number }[];

  const stats = {
    total:     0,
    published: 0,
    scheduled: 0,
    draft:     0,
    failed:    0,
  };
  for (const r of rows) {
    stats.total += r.count;
    if (r.status in stats) stats[r.status as keyof typeof stats] = r.count;
  }
  return NextResponse.json(stats);
}
