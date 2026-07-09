export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertResourceBrand, isAllBrands } from '@/lib/brand-guard';

// GET /api/knowledge/[id] — return full doc content
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const doc = db
      .prepare('SELECT * FROM knowledge_docs WHERE id = ?')
      .get(params.id) as Record<string, unknown> | undefined;

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const denied = assertResourceBrand(req, doc.brand_id as string | undefined);
    if (denied) return denied;

    return NextResponse.json({ doc });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// PATCH /api/knowledge/[id] — Promote/hạ scope (platform ↔ brand). CHỈ super-admin.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isAllBrands(req)) return NextResponse.json({ error: 'Chỉ super-admin được Promote lên toàn hệ' }, { status: 403 });
    const { scope } = await req.json() as { scope?: string };
    const s = scope === 'platform' ? 'platform' : 'brand';
    const db = getDb();
    const row = db.prepare('SELECT id FROM knowledge_docs WHERE id=?').get(params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    db.prepare('UPDATE knowledge_docs SET scope=? WHERE id=?').run(s, params.id);
    return NextResponse.json({ ok: true, scope: s });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
