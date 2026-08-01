export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId, assertResourceBrand, isAllBrands } from '@/lib/brand-guard';

// GET /api/knowledge/[id] — return full doc content
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
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
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
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

// DELETE /api/knowledge/[id] — xoá tri thức (card 3fa4e238: UI thiếu nút xoá).
// Guard theo brand của chính doc; doc scope='platform' chỉ super-admin được xoá.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
  try {
    const db = getDb();
    const doc = db.prepare('SELECT brand_id, scope FROM knowledge_docs WHERE id=?')
      .get(params.id) as { brand_id?: string; scope?: string } | undefined;
    if (!doc) return NextResponse.json({ ok: true });
    if (doc.scope === 'platform' && !isAllBrands(req)) {
      return NextResponse.json({ error: 'Tri thức toàn hệ — chỉ super-admin được xoá' }, { status: 403 });
    }
    const denied = assertResourceBrand(req, doc.brand_id);
    if (denied) return denied;
    db.prepare('DELETE FROM knowledge_docs WHERE id=?').run(params.id);
    try { db.prepare('DELETE FROM knowledge_log WHERE doc_id=?').run(params.id); } catch { /* bảng phụ */ }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}
