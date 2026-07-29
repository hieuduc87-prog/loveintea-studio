export const dynamic = 'force-dynamic';
/**
 * GET /api/usage — mức dùng của brand trong tháng, cho KHÁCH xem.
 *
 * CHỈ trả SỐ LƯỢNG (đã dùng / hạn mức). KHÔNG bao giờ trả cap_usd hay số tiền:
 * đó là giá vốn, thuộc nhóm nội bộ (xem docs/multi-brand-architecture.md NT5).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBrandId } from '@/lib/brand-guard';
import { getQuota, getUsage, currentPeriod } from '@/lib/quota';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  if (!brandId) return NextResponse.json({ error: 'Thiếu brand' }, { status: 400 });

  const q = getQuota(brandId);
  const used = getUsage(brandId);
  const pack = (u: number, limit: number) => ({
    used: u,
    limit,                                   // -1 = không giới hạn
    remaining: limit < 0 ? -1 : Math.max(0, limit - u),
    percent: limit <= 0 ? 0 : Math.min(100, Math.round((u / limit) * 100)),
  });

  return NextResponse.json({
    period: currentPeriod(),
    plan: q.plan,
    video: pack(used.video, q.videos),
    image: pack(used.image, q.images),
    content: pack(used.content, q.content),
  });
}
