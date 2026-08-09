export const dynamic = 'force-dynamic';
/**
 * POST /api/video/projects/[id]/render — enqueue render.
 * The background scheduler picks up `queued` projects one at a time
 * (2 vCPU server — strictly sequential renders).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { reserveQuota } from '@/lib/quota';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const brandId = getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
  const limited = enforceRateLimit(req, { scope: 'ai:render', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const db = getDb();
  const p = db.prepare('SELECT status, brand_id FROM video_projects WHERE id=?').get(params.id) as { status: string; brand_id: string } | undefined;
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, p.brand_id);
  if (denied) return denied;
  if (p.status === 'rendering' || p.status === 'queued') {
    return NextResponse.json({ ok: true, status: p.status });
  }
  // SEC (vbsec C4): render fal.ai TỐN TIỀN — phải trừ hạn mức video, nếu không attacker/khách
  // enqueue vô hạn = cost-DoS. Reserve khi CHUYỂN sang queued (không double-reserve vì đã chặn ở trên).
  const overQuota = reserveQuota(brandId, 'video', 1);
  if (overQuota) return NextResponse.json({ error: overQuota.error }, { status: 429 });
  db.prepare(`UPDATE video_projects SET status='queued', error=NULL, updated_at=datetime('now') WHERE id=?`).run(params.id);
  return NextResponse.json({ ok: true, status: 'queued' });
}
