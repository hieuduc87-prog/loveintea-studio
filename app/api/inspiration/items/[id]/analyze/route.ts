export const dynamic = 'force-dynamic';
/**
 * POST /api/inspiration/items/[id]/analyze — chạy phân tích nền (tải video nếu cần
 * → Gemini video analysis → recipe + bài học). Trả ngay; UI poll status qua GET items.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { analyzeInspirationItem } from '@/lib/inspiration/analyze';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const limited = enforceRateLimit(req, { scope: 'ai:inspiration', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const brandId = getBrandId(req);
  const db = getDb();
  const item = db.prepare('SELECT id, status FROM inspiration_items WHERE id=? AND brand_id=?')
    .get(params.id, brandId) as { id: string; status: string } | undefined;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.status === 'downloading' || item.status === 'analyzing') {
    return NextResponse.json({ ok: true, status: item.status });
  }
  // Chạy nền — download + Gemini có thể mất vài phút.
  void analyzeInspirationItem(params.id, brandId).catch(e =>
    console.error('[inspiration] analyze failed:', params.id, e));
  return NextResponse.json({ ok: true, status: 'analyzing' });
}
