export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateO3Content } from '@/lib/o3-engine';
import { getBrandId } from '@/lib/brand-guard';

export async function POST(req: NextRequest) {
  const _rl = enforceRateLimit(req, { scope: 'ai:content-generate', limit: 20, windowMs: 60_000 }); // SEC (vbsec H3): chống spam đốt tiền Gemini
  if (_rl) return _rl;
  try {
    const body = await req.json();
    // Brand lấy từ header trung gian đã soát quyền (L3) — không tin body.
    const result = await generateO3Content({ ...body, brandId: getBrandId(req) || body.brandId || '' });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
