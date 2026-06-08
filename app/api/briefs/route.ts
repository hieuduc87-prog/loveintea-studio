export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateBrief } from '@/lib/o3-engine';

// GET /api/briefs?brandId=X — list briefs
export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brandId') || 'loveintea';
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM briefs WHERE brand_id = ? ORDER BY created_at DESC LIMIT 100`
    ).all(brandId);
    return NextResponse.json({ briefs: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/briefs — generate a brief from slot config
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brief = await generateBrief({
      brandId: body.brandId || 'loveintea',
      planItemId: body.planItemId,
      channel: body.channel || 'instagram',
      skuId: body.skuId,
      segmentId: body.segmentId,
      rtbId: body.rtbId,
      uspId: body.uspId,
      contextId: body.contextId,
      narrativeId: body.narrativeId,
    });
    return NextResponse.json({ ok: true, brief }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
