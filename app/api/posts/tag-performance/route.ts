export const dynamic = 'force-dynamic';
/**
 * GET /api/posts/tag-performance?brand=x
 * Aggregated win-rate per tag (dimension+value) across published posts — the DB
 * roll-up for optimisation ("which segment/insight/behavior/combo wins").
 */
import { NextRequest, NextResponse } from 'next/server';
import { tagPerformance } from '@/lib/post-tags';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brand') || 'loveintea';
  const rows = tagPerformance(brandId);
  // group by dimension for the UI
  const byDim: Record<string, typeof rows> = {};
  for (const r of rows) (byDim[r.dimension] ||= []).push(r);
  return NextResponse.json({ rows, byDimension: byDim });
}
