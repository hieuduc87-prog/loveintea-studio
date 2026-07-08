export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateBrief } from '@/lib/o3-engine';
import { getBrandId } from '@/lib/brand-guard';

// GET /api/briefs?brandId=X — list briefs
export async function GET(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM briefs WHERE brand_id = ? ORDER BY created_at DESC LIMIT 100`
    ).all(brandId);
    return NextResponse.json({ briefs: rows });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// POST /api/briefs — generate a brief from slot config
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brief = await generateBrief({
      brandId: getBrandId(req) || body.brandId || '',
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
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
