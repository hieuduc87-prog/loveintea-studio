export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/scoreboard?brandId=X — get scoreboard with verdicts
export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brandId') || 'loveintea';
    const db = getDb();

    // Get current scoreboard entries
    const entries = db.prepare(
      `SELECT * FROM scoreboard WHERE brand_id = ? ORDER BY verdict ASC, sample_size DESC`
    ).all(brandId) as Array<Record<string, unknown>>;

    // Get summary stats
    const stats = {
      total: entries.length,
      scale: entries.filter((e: Record<string, unknown>) => e.verdict === 'SCALE').length,
      hold: entries.filter((e: Record<string, unknown>) => e.verdict === 'HOLD').length,
      retire: entries.filter((e: Record<string, unknown>) => e.verdict === 'RETIRE').length,
    };

    // Check if we have enough data to compute verdicts
    const postCount = (db.prepare(
      `SELECT COUNT(*) as n FROM posts WHERE brand_id = ? AND status = 'published'`
    ).get(brandId) as { n: number }).n;

    return NextResponse.json({
      entries,
      stats,
      postCount,
      hasEnoughData: postCount >= 10,
      message: postCount < 10
        ? `Need ${10 - postCount} more published posts before scoreboard can compute verdicts. Currently all angles are HOLD.`
        : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/scoreboard — manually update or recompute scoreboard
export async function POST(req: NextRequest) {
  try {
    const { brandId, action } = await req.json() as { brandId?: string; action?: string };
    const bid = brandId || 'loveintea';

    if (action === 'recompute') {
      const { recomputeScoreboard } = await import('@/lib/scoreboard-engine');
      const r = recomputeScoreboard(bid);
      return NextResponse.json({ ok: true, ...r });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
