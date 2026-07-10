export const dynamic = 'force-dynamic';
/**
 * PATCH /api/rules/[id] — Promote/hạ scope một content rule
 * ('platform' = nguyên tắc chung áp MỌI brand ↔ 'brand' = riêng brand).
 * CHỈ super-admin (giống knowledge promote).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAllBrands } from '@/lib/brand-guard';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isAllBrands(req)) return NextResponse.json({ error: 'Chỉ super-admin được Promote lên toàn hệ' }, { status: 403 });
    const { scope } = await req.json() as { scope?: string };
    const s = scope === 'platform' ? 'platform' : 'brand';
    const db = getDb();
    const row = db.prepare('SELECT id FROM content_rules WHERE id=?').get(params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    db.prepare('UPDATE content_rules SET scope=? WHERE id=?').run(s, params.id);
    return NextResponse.json({ ok: true, scope: s });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
